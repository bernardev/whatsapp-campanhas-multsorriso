// app/api/conversas/[remoteJid]/marcar-respondido/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
// DELETE fica só-cookie de propósito (F6: o app externo marca, mas não desmarca).
// authorizeUser = sessão do painel revalidada no banco (F4).
import { authorize as authorizeUser } from '@/lib/auth'
import { authorize, canAccessConversation } from '@/lib/caller'
import { remoteJidVariants } from '@/lib/phone'

interface RouteContext {
  params: Promise<{ remoteJid: string }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const auth = await authorize('conversas:responder')
    if (!auth.ok) return auth.response
    const { caller } = auth

    const { remoteJid: rawJid } = await context.params
    const remoteJid = decodeURIComponent(rawJid)

    // F6: token de serviço só marca conversa que existe numa instância dele.
    if (!(await canAccessConversation(caller, remoteJidVariants(remoteJid)))) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    // FK para User: token de serviço não é usuário → null
    const respondedByUserId = caller.kind === 'user' ? caller.id : null

    await prisma.conversationResponse.upsert({
      where: { remoteJid },
      update: {
        needsResponse: false,
        notificationRead: true,
        respondedAt: new Date(),
        respondedByUserId,
        updatedAt: new Date()
      },
      create: {
        remoteJid,
        needsResponse: false,
        notificationRead: true,
        lastMessageAt: new Date(),
        respondedAt: new Date(),
        respondedByUserId
      }
    })

    console.log(`[Conversas] (${caller.kind}:${caller.name}) Marcada como respondida:`, remoteJid)

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
    const auth = await authorizeUser()
    if (!auth.ok) return auth.response

    const { remoteJid } = await context.params

    await prisma.conversationResponse.upsert({
      where: { remoteJid },
      update: {
        needsResponse: true,
        notificationRead: false,
        respondedAt: null,
        respondedByUserId: null,
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