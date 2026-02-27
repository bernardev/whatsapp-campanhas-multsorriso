// app/api/conversas/[remoteJid]/mensagens/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ remoteJid: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { remoteJid } = await context.params
    const decodedJid = decodeURIComponent(remoteJid)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = 50
    const skip = (page - 1) * limit

    // Busca do banco local — filtra pelo remoteJid exato
    const [mensagensRaw, total] = await Promise.all([
      prisma.conversationMessage.findMany({
        where: { remoteJid: decodedJid },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip,
      }),
      prisma.conversationMessage.count({
        where: { remoteJid: decodedJid },
      }),
    ])

    const mensagens = mensagensRaw.map((msg) => ({
      id: msg.messageId,
      messageText: msg.messageText,
      fromMe: msg.fromMe,
      timestamp: msg.timestamp,
      pushName: msg.pushName,
      messageType: msg.messageType,
    }))

    return NextResponse.json({
      mensagens,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      }
    })

  } catch (error) {
    console.error('[Mensagens] Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}