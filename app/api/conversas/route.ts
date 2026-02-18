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

    for (const msg of allMessages) {
      const key = msg.remoteJid
      
      if (!conversasMap.has(key)) {
        const isGroup = msg.remoteJid.includes('@g.us')
        
        const displayPhone = msg.remoteJid
          .replace('@s.whatsapp.net', '')
          .replace('@g.us', '')
          .replace(/\D/g, '')

        const displayName = msg.pushName || displayPhone

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
          displayName,
          displayPhone,
          isGroup,
          lastMessage: msg.messageText,
          lastMessageAt: msg.timestamp,
          lastMessageFromMe: msg.fromMe,
          needsResponse,
          messages: []
        })
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

    return NextResponse.json({ conversas })
  } catch (error) {
    console.error('Erro ao buscar conversas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar conversas' },
      { status: 500 }
    )
  }
}