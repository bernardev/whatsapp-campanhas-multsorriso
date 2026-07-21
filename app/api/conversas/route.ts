// app/api/conversas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { canonicalKey, remoteJidVariants, parseCampaign } from '@/lib/phone'

interface Conversa {
  remoteJid: string // variante representativa (a da mensagem mais recente)
  displayName: string
  displayPhone: string
  isGroup: boolean
  lastMessage: string
  lastMessageAt: Date
  lastMessageFromMe: boolean
  needsResponse: boolean
  lastCampaign: string | null // etiqueta: última campanha enviada a este número
  lastCampaignBy: string | null // usuário que disparou essa campanha
  messages: never[] // carregadas sob demanda em /api/conversas/[remoteJid]/mensagens
}

interface LastRow {
  remoteJid: string
  messageText: string
  fromMe: boolean
  timestamp: Date
}
interface TplRow {
  remoteJid: string
  messageText: string
  timestamp: Date
  sender: string | null // nome do usuário que criou/disparou a campanha
}
interface NameRow {
  remoteJid: string
  pushName: string | null
  timestamp: Date
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Última mensagem de CADA variante de número (1 linha por remoteJid).
    const lastRows = await prisma.$queryRaw<LastRow[]>`
      SELECT DISTINCT ON ("remoteJid")
        "remoteJid", "messageText", "fromMe", "timestamp"
      FROM "conversation_messages"
      ORDER BY "remoteJid", "timestamp" DESC
    `

    // Última mensagem de CAMPANHA (template) enviada, por variante de número,
    // já resolvendo QUEM disparou: ConversationMessage.messageId (wamid) casa com
    // Message.providerMessageId → Campaign → User.
    const tplRows = await prisma.$queryRaw<TplRow[]>`
      SELECT DISTINCT ON (cm."remoteJid")
        cm."remoteJid", cm."messageText", cm."timestamp", u."name" AS sender
      FROM "conversation_messages" cm
      LEFT JOIN "Message" m ON m."providerMessageId" = cm."messageId"
      LEFT JOIN "Campaign" c ON c."id" = m."campaignId"
      LEFT JOIN "User" u ON u."id" = c."userId"
      WHERE cm."fromMe" = true
        AND (cm."messageText" LIKE '[template:%' OR cm."messageText" LIKE '▶%')
      ORDER BY cm."remoteJid", cm."timestamp" DESC
    `

    // pushName da mensagem RECEBIDA mais recente, por variante de número.
    const nameRows = await prisma.$queryRaw<NameRow[]>`
      SELECT DISTINCT ON ("remoteJid")
        "remoteJid", "pushName", "timestamp"
      FROM "conversation_messages"
      WHERE "fromMe" = false AND "pushName" IS NOT NULL
      ORDER BY "remoteJid", "timestamp" DESC
    `

    const responseStatuses = await prisma.conversationResponse.findMany()
    const responseMap = new Map(
      responseStatuses.map(r => [r.remoteJid, r.needsResponse])
    )

    // ===== Agrupa por número canônico (junta as variantes de formato) =====
    interface Grp {
      remoteJid: string
      lastMessage: string
      lastMessageAt: Date
      lastMessageFromMe: boolean
    }
    const grpMap = new Map<string, Grp>()
    for (const row of lastRows) {
      const k = canonicalKey(row.remoteJid)
      const cur = grpMap.get(k)
      if (!cur || row.timestamp > cur.lastMessageAt) {
        grpMap.set(k, {
          remoteJid: row.remoteJid, // representativa = a da msg mais recente
          lastMessage: row.messageText,
          lastMessageAt: row.timestamp,
          lastMessageFromMe: row.fromMe,
        })
      }
    }

    // Etiqueta: última campanha (e quem disparou) por número canônico
    const campMap = new Map<string, { name: string; sender: string | null; at: Date }>()
    for (const row of tplRows) {
      const name = parseCampaign(row.messageText)
      if (!name) continue
      const k = canonicalKey(row.remoteJid)
      const cur = campMap.get(k)
      if (!cur || row.timestamp > cur.at) campMap.set(k, { name, sender: row.sender, at: row.timestamp })
    }

    // Nome do WhatsApp por número canônico (o mais recente entre as variantes)
    const nameMap = new Map<string, { name: string; at: Date }>()
    for (const row of nameRows) {
      if (!row.pushName) continue
      const k = canonicalKey(row.remoteJid)
      const cur = nameMap.get(k)
      if (!cur || row.timestamp > cur.at) nameMap.set(k, { name: row.pushName, at: row.timestamp })
    }

    // needsResponse por conversa: registro explícito (qualquer variante) ou, na
    // ausência, a última mensagem não ter sido enviada por nós.
    const resolveNeeds = (grp: Grp): boolean => {
      if (responseMap.has(grp.remoteJid)) return responseMap.get(grp.remoteJid) || false
      for (const v of remoteJidVariants(grp.remoteJid)) {
        if (responseMap.has(v)) return responseMap.get(v) || false
      }
      return !grp.lastMessageFromMe
    }

    const conversas: Conversa[] = []
    for (const [k, grp] of grpMap) {
      const isGroup = grp.remoteJid.includes('@g.us')
      const displayPhone = grp.remoteJid
        .replace('@s.whatsapp.net', '')
        .replace('@g.us', '')
        .replace(/\D/g, '')

      conversas.push({
        remoteJid: grp.remoteJid,
        displayName: displayPhone,
        displayPhone,
        isGroup,
        lastMessage: grp.lastMessage,
        lastMessageAt: grp.lastMessageAt,
        lastMessageFromMe: grp.lastMessageFromMe,
        needsResponse: resolveNeeds(grp),
        lastCampaign: campMap.get(k)?.name ?? null,
        lastCampaignBy: campMap.get(k)?.sender ?? null,
        messages: [],
      })
    }

    // ===== Resolução de nome: WhatsApp → base de contatos → número =====
    const contactName = new Map<string, string>()
    const contacts = await prisma.contact.findMany({
      where: { name: { not: null } },
      select: { phone: true, name: true }
    })
    for (const ct of contacts) {
      if (!ct.name) continue
      const k = canonicalKey(ct.phone)
      if (!contactName.has(k)) contactName.set(k, ct.name)
    }

    for (const c of conversas) {
      const k = canonicalKey(c.remoteJid)
      const wa = nameMap.get(k)?.name
      if (wa) {
        c.displayName = wa
        continue
      }
      if (!c.isGroup) {
        const base = contactName.get(k)
        if (base) c.displayName = base
      }
    }

    return NextResponse.json({ conversas })
  } catch (error) {
    console.error('Erro ao buscar conversas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar conversas' },
      { status: 500 }
    )
  }
}
