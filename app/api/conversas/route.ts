// app/api/conversas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

interface Message {
  id: string
  messageText: string
  fromMe: boolean
  timestamp: Date
  pushName: string | null
}

interface Conversa {
  remoteJid: string
  displayName: string
  displayPhone: string
  isGroup: boolean
  lastMessage: string
  lastMessageAt: Date
  lastMessageFromMe: boolean
  needsResponse: boolean
  messages: Message[]
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Busca todas as mensagens
    const allMessages = await prisma.conversationMessage.findMany({
      orderBy: {
        timestamp: 'desc'
      },
      take: 1000
    })

    // Busca status de respostas
    const responseStatuses = await prisma.conversationResponse.findMany()
    const responseMap = new Map(
      responseStatuses.map(r => [r.remoteJid, r.needsResponse])
    )

    // Agrupa por conversa
    const conversasMap = new Map<string, Conversa>()

    // Nome do perfil do WhatsApp: pushName da mensagem RECEBIDA mais recente.
    // Nunca usa pushName de mensagem enviada (que carrega o nome do operador).
    const whatsappName = new Map<string, string>()

    for (const msg of allMessages) {
      const key = msg.remoteJid

      if (!conversasMap.has(key)) {
        const isGroup = msg.remoteJid.includes('@g.us')

        const displayPhone = msg.remoteJid
          .replace('@s.whatsapp.net', '')
          .replace('@g.us', '')
          .replace(/\D/g, '')

        // Determina se precisa de resposta
        let needsResponse = false
        if (responseMap.has(key)) {
          needsResponse = responseMap.get(key) || false
        } else {
          // Se não tem registro, verifica última mensagem
          needsResponse = !msg.fromMe
        }

        conversasMap.set(key, {
          remoteJid: msg.remoteJid,
          displayName: displayPhone,
          displayPhone,
          isGroup,
          lastMessage: msg.messageText,
          lastMessageAt: msg.timestamp,
          lastMessageFromMe: msg.fromMe,
          needsResponse,
          messages: []
        })
      }

      // Mensagens vêm em ordem desc → a 1ª recebida com pushName é a mais recente
      if (!msg.fromMe && msg.pushName && !whatsappName.has(key)) {
        whatsappName.set(key, msg.pushName)
      }

      const conversa = conversasMap.get(key)!
      conversa.messages.push({
        id: msg.id,
        messageText: msg.messageText,
        fromMe: msg.fromMe,
        timestamp: msg.timestamp,
        pushName: msg.pushName
      })
    }

    const conversas = Array.from(conversasMap.values())

    // Fallback de nome: base de contatos, casada por telefone (tolerando "+"
    // e o 9º dígito).
    const phoneQuery = new Set<string>()
    for (const c of conversas) {
      if (c.isGroup) continue
      for (const d of digitVariants(c.displayPhone)) {
        phoneQuery.add(d)
        phoneQuery.add('+' + d)
      }
    }

    const contactName = new Map<string, string>()
    if (phoneQuery.size > 0) {
      const contacts = await prisma.contact.findMany({
        where: { phone: { in: [...phoneQuery] }, name: { not: null } },
        select: { phone: true, name: true }
      })
      for (const ct of contacts) {
        if (!ct.name) continue
        for (const d of digitVariants(ct.phone.replace(/\D/g, ''))) {
          if (!contactName.has(d)) contactName.set(d, ct.name)
        }
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
