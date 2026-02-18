// app/api/campanhas/[id]/excluir/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ id: string }>
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

    const { id } = await context.params

    // Verifica se a campanha existe e pertence ao usuário
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId: user.id
      },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    }

    // Deleta mensagens primeiro (cascade)
    await prisma.message.deleteMany({
      where: { campaignId: id }
    })

    // Deleta a campanha
    await prisma.campaign.delete({
      where: { id }
    })

    console.log(`🗑️ [Campanha] Excluída: ${campaign.name} (${campaign._count.messages} mensagens)`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir campanha:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir campanha' },
      { status: 500 }
    )
  }
}