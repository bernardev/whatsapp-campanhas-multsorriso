// app/api/notificacoes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/auth'

interface Notificacao {
  id: string
  type: 'nova_resposta' | 'aguardando_10min' | 'aguardando_30min' | 'aguardando_1h'
  clientName: string
  remoteJid: string
  lastMessage: string
  waitingMinutes: number
  timestamp: Date
}

interface Linha {
  id: string
  remoteJid: string
  lastMessageAt: Date
  pushName: string | null
  messageText: string
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authorize()
    if (!auth.ok) return auth.response

    // Uma consulta só. Antes isto era um N+1: a lista de pendências e, para
    // cada uma, um findFirst atrás da última mensagem. Com o polling de 10s em
    // três telas, 50 conversas sem resposta viravam 51 consultas por ciclo.
    // O LATERAL resolve a última mensagem de cada remoteJid usando o índice
    // (remoteJid) e devolve tudo de uma vez.
    const linhas = await prisma.$queryRaw<Linha[]>`
      SELECT cr."id", cr."remoteJid", cr."lastMessageAt",
             lm."pushName", lm."messageText"
      FROM "conversation_responses" cr
      JOIN LATERAL (
        SELECT cm."pushName", cm."messageText"
        FROM "conversation_messages" cm
        WHERE cm."remoteJid" = cr."remoteJid"
        ORDER BY cm."timestamp" DESC
        LIMIT 1
      ) lm ON TRUE
      WHERE cr."needsResponse" = TRUE AND cr."notificationRead" = FALSE
      ORDER BY cr."lastMessageAt" DESC
      LIMIT 50
    `

    const now = Date.now()
    const notificacoes: Notificacao[] = linhas.map((l) => {
      const waitingMinutes = Math.floor(
        (now - new Date(l.lastMessageAt).getTime()) / 60000
      )

      const phone = l.remoteJid
        .replace('@s.whatsapp.net', '')
        .replace('@g.us', '')
        .replace(/\D/g, '')

      let type: Notificacao['type'] = 'nova_resposta'
      if (waitingMinutes >= 60) {
        type = 'aguardando_1h'
      } else if (waitingMinutes >= 30) {
        type = 'aguardando_30min'
      } else if (waitingMinutes >= 10) {
        type = 'aguardando_10min'
      }

      return {
        id: l.id,
        type,
        clientName: l.pushName || phone,
        remoteJid: l.remoteJid,
        lastMessage: (l.messageText || '').substring(0, 50),
        waitingMinutes,
        timestamp: l.lastMessageAt,
      }
    })

    return NextResponse.json({ notificacoes })
  } catch (error) {
    console.error('Erro ao buscar notificações:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar notificações' },
      { status: 500 }
    )
  }
}
