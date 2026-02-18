// app/api/leads/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { LeadStatus } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface UpdateLeadBody {
  status?: LeadStatus
  isHot?: boolean
  assignedToUserId?: string | null
  notes?: string
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json() as UpdateLeadBody

    // Atualiza o lead
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.isHot !== undefined && { isHot: body.isHot }),
        ...(body.assignedToUserId !== undefined && { assignedToUserId: body.assignedToUserId }),
        ...(body.notes !== undefined && { notes: body.notes }),
        updatedAt: new Date()
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    console.log(`[Lead] Atualizado: ${id}`, body)

    return NextResponse.json({ lead })
  } catch (error) {
    console.error('Erro ao atualizar lead:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar lead' },
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

    const { id } = await context.params

    // Deleta o lead
    await prisma.lead.delete({
      where: { id }
    })

    console.log(`[Lead] Excluído: ${id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir lead:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir lead' },
      { status: 500 }
    )
  }
}