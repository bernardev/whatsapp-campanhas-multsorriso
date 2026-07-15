// app/api/conversas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

interface Conversa {
  remoteJid: string
  displayName: string
  displayPhone: string
  isGroup: boolean
  lastMessage: string
  lastMessageAt: Date
  lastMessageFromMe: boolean
  needsResponse: boolean
  messages: never[] // carregadas sob demanda em /api/conversas/[remoteJid]/mensagens
}

// Telefones BR podem ter ou não o 9º dígito (após 55 + DDD). Gera as duas
// formas, em dígitos puros, para casar conversa × base de contatos.
function digitVariants(digits: string): string[] {
  const set = new Set<string>([digits])
  if (digits.length === 12) {
    set.add(digits.slice(0, 4) + '9' + digits.slice(4))
  }
  if (digits.length === 13 && digits[4] === '9') {
    set.add(digits.slice(0, 4) + digits.slice(5))
  }
  return [...set]
}

interface LastRow {
  remoteJid: string
  messageText: string
  fromMe: boolean
  timestamp: Date
}
interface NameRow {
  remoteJid: string
  pushName: string | null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Última mensagem de CADA conversa — sem limite de conversas. O DISTINCT ON
    // resolve no banco (1 linha por remoteJid), então mesmo com centenas de
    // milhares de mensagens só trafegamos uma linha por conversa.
    const lastRows = await prisma.$queryRaw<LastRow[]>`
      SELECT DISTINCT ON ("remoteJid")
        "remoteJid", "messageText", "fromMe", "timestamp"
      FROM "conversation_messages"
      ORDER BY "remoteJid", "timestamp" DESC
    `

    // Nome do perfil do WhatsApp: pushName da mensagem RECEBIDA mais recente de
    // cada conversa. Nunca usa pushName de mensagem enviada (que carrega o nome
    // do operador).
    const nameRows = await prisma.$queryRaw<NameRow[]>`
      SELECT DISTINCT ON ("remoteJid")
        "remoteJid", "pushName"
      FROM "conversation_messages"
      WHERE "fromMe" = false AND "pushName" IS NOT NULL
      ORDER BY "remoteJid", "timestamp" DESC
    `
    const whatsappName = new Map<string, string>()
    for (const r of nameRows) {
      if (r.pushName) whatsappName.set(r.remoteJid, r.pushName)
    }

    // Busca status de respostas
    const responseStatuses = await prisma.conversationResponse.findMany()
    const responseMap = new Map(
      responseStatuses.map(r => [r.remoteJid, r.needsResponse])
    )

    const conversas: Conversa[] = lastRows.map((row) => {
      const isGroup = row.remoteJid.includes('@g.us')

      const displayPhone = row.remoteJid
        .replace('@s.whatsapp.net', '')
        .replace('@g.us', '')
        .replace(/\D/g, '')

      // Determina se precisa de resposta: registro explícito ou, na ausência,
      // a última mensagem não ter sido enviada por nós.
      const needsResponse = responseMap.has(row.remoteJid)
        ? (responseMap.get(row.remoteJid) || false)
        : !row.fromMe

      return {
        remoteJid: row.remoteJid,
        displayName: displayPhone,
        displayPhone,
        isGroup,
        lastMessage: row.messageText,
        lastMessageAt: row.timestamp,
        lastMessageFromMe: row.fromMe,
        needsResponse,
        messages: [],
      }
    })

    // Fallback de nome: base de contatos, casada por telefone (tolerando "+"
    // e o 9º dígito). Buscamos todos os contatos com nome de uma vez e montamos
    // um índice por telefone — evita um IN gigante (dezenas de milhares de
    // telefones) agora que a lista traz todas as conversas.
    const contactName = new Map<string, string>()
    const contacts = await prisma.contact.findMany({
      where: { name: { not: null } },
      select: { phone: true, name: true }
    })
    for (const ct of contacts) {
      if (!ct.name) continue
      for (const d of digitVariants(ct.phone.replace(/\D/g, ''))) {
        if (!contactName.has(d)) contactName.set(d, ct.name)
      }
    }

    // Prioridade: nome do WhatsApp → base de contatos → número
    for (const c of conversas) {
      const wa = whatsappName.get(c.remoteJid)
      if (wa) {
        c.displayName = wa
        continue
      }
      if (!c.isGroup) {
        for (const d of digitVariants(c.displayPhone)) {
          const base = contactName.get(d)
          if (base) {
            c.displayName = base
            break
          }
        }
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
