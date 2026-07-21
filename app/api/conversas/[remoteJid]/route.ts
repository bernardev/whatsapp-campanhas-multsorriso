// app/api/conversas/[remoteJid]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { remoteJidVariants } from '@/lib/phone'

interface RouteContext {
  params: Promise<{ remoteJid: string }>
}

// Exclui a conversa DO PAINEL: apaga as mensagens locais (todas as variantes de
// formato do número) e o status de resposta. Não afeta o WhatsApp do paciente.
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
    const decodedJid = decodeURIComponent(remoteJid)
    const variants = remoteJidVariants(decodedJid)

    const [msgs, resp] = await prisma.$transaction([
      prisma.conversationMessage.deleteMany({
        where: { remoteJid: { in: variants } },
      }),
      prisma.conversationResponse.deleteMany({
        where: { remoteJid: { in: variants } },
      }),
    ])

    console.log(
      `[Conversas] ${user.email} excluiu conversa ${decodedJid} — ${msgs.count} mensagem(ns), ${resp.count} status`
    )

    return NextResponse.json({ success: true, deleted: msgs.count })
  } catch (error) {
    console.error('[Conversas] Erro ao excluir conversa:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir conversa' },
      { status: 500 }
    )
  }
}
