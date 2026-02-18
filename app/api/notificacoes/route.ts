// app/api/notificacoes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

interface Notificacao {
  id: string
  type: 'nova_resposta' | 'aguardando_10min' | 'aguardando_30min' | 'aguardando_1h'
  clientName: string
  phone: string
  remoteJid: string
  lastMessage: string
  waitingMinutes: number
  timestamp: Date
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const now = new Date()
    const notificacoes: Notificacao[] = []

    // Busca conversas que precisam de resposta
    const conversasResponse = await prisma.conversationResponse.findMany({
      where: {
        needsResponse: true,
        notificationRead: false
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    })
    console.log(`[Notificacoes] Total de conversas encontradas: ${conversasResponse.length}`)
    console.log(`[Notificacoes] RemoteJids:`, conversasResponse.map(c => c.remoteJid))
    for (const conv of conversasResponse) {
      // Busca última mensagem
      const lastMessage = await prisma.conversationMessage.findFirst({
        where: { remoteJid: conv.remoteJid },
        orderBy: { timestamp: 'desc' }
      })

      if (!lastMessage) continue

      const diffMs = now.getTime() - new Date(conv.lastMessageAt).getTime()
      const waitingMinutes = Math.floor(diffMs / 60000)

      const phone = conv.remoteJid
        .replace('@s.whatsapp.net', '')
        .replace('@g.us', '')
        .replace(/\D/g, '')

      const clientName = lastMessage.pushName || phone

      // Determina o tipo de notificação baseado no tempo
      let type: Notificacao['type'] = 'nova_resposta'
      
      if (waitingMinutes >= 60) {
        type = 'aguardando_1h'
      } else if (waitingMinutes >= 30) {
        type = 'aguardando_30min'
      } else if (waitingMinutes >= 10) {
        type = 'aguardando_10min'
      }

      notificacoes.push({
        id: conv.id,
        type,
        clientName,
        phone,
        remoteJid: conv.remoteJid,
        lastMessage: lastMessage.messageText.substring(0, 50),
        waitingMinutes,
        timestamp: conv.lastMessageAt
      })
    }

    return NextResponse.json({ notificacoes })
  } catch (error) {
    console.error('Erro ao buscar notificações:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar notificações' },
      { status: 500 }
    )
  }
}