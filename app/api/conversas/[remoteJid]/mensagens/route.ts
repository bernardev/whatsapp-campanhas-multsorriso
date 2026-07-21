// app/api/conversas/[remoteJid]/mensagens/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { remoteJidVariants } from '@/lib/phone'

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
    // Junta todas as variantes de formato do número (com/sem "+", com/sem o 9º
    // dígito) para trazer o histórico completo da mesma pessoa.
    const variants = remoteJidVariants(decodedJid)

    const { searchParams } = new URL(request.url)
    // Sem `page` na querystring → devolve o histórico COMPLETO da conversa
    // (atendimento precisa ver mensagens antigas). Com `page`, mantém a
    // paginação de 50 em 50 para quem quiser consumir aos poucos.
    const pageParam = searchParams.get('page')
    const paginate = pageParam !== null
    const page = paginate ? Math.max(1, parseInt(pageParam, 10) || 1) : 1
    const limit = 50
    const skip = (page - 1) * limit

    // Busca do banco local — filtra pelo remoteJid exato
    const [mensagensRaw, total] = await Promise.all([
      prisma.conversationMessage.findMany({
        where: { remoteJid: { in: variants } },
        orderBy: { timestamp: 'desc' },
        ...(paginate ? { take: limit, skip } : {}),
      }),
      prisma.conversationMessage.count({
        where: { remoteJid: { in: variants } },
      }),
    ])

    const mensagens = mensagensRaw.map((msg) => ({
      id: msg.messageId,
      messageText: msg.messageText,
      fromMe: msg.fromMe,
      timestamp: msg.timestamp,
      pushName: msg.pushName,
      messageType: msg.messageType,
      mediaUrl: msg.mediaUrl,
      mediaMimeType: msg.mediaMimeType,
    }))

    return NextResponse.json({
      mensagens,
      pagination: {
        page,
        pages: paginate ? Math.ceil(total / limit) : 1,
        total,
        limit: paginate ? limit : total,
      }
    })

  } catch (error) {
    console.error('[Mensagens] Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}