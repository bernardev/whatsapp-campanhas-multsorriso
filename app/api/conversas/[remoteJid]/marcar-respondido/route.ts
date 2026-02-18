// app/api/conversas/[remoteJid]/marcar-respondido/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ remoteJid: string }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { remoteJid } = await context.params

    await prisma.conversationResponse.upsert({
      where: { remoteJid },
      update: {
        needsResponse: false,
        notificationRead: true,
        respondedAt: new Date(),
        updatedAt: new Date()
      },
      create: {
        remoteJid,
        needsResponse: false,
        notificationRead: true,
        lastMessageAt: new Date(),
        respondedAt: new Date()
      }
    })

    console.log('[Conversas] Marcada como respondida:', remoteJid)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Conversas] Erro ao marcar como respondido:', error)
    return NextResponse.json(
      { error: 'Erro ao marcar como respondido' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { remoteJid } = await context.params

    await prisma.conversationResponse.upsert({
      where: { remoteJid },
      update: {
        needsResponse: true,
        notificationRead: false,
        respondedAt: null,
        updatedAt: new Date()
      },
      create: {
        remoteJid,
        needsResponse: true,
        notificationRead: false,
        lastMessageAt: new Date()
      }
    })

    console.log('[Conversas] Marcada como não respondida:', remoteJid)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Conversas] Erro ao marcar como não respondido:', error)
    return NextResponse.json(
      { error: 'Erro ao marcar como não respondido' },
      { status: 500 }
    )
  }
}