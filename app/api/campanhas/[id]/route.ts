// app/api/campanhas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import { MessageStatus } from '@/types/message'

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'seu-secret-super-seguro'
)

async function getUserFromToken(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  if (!token) return null
  
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload.userId as string
  } catch {
    return null
  }
}

interface MessageWithStatus {
  status: MessageStatus
}

// GET - Detalhes da campanha
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    
    const campaign = await prisma.campaign.findFirst({
      where: { 
        id,
        userId 
      },
      include: {
        contacts: {
          include: {
            contact: true
          }
        },
        messages: {
          include: {
            contact: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      )
    }

    // Calcula estatísticas
    const messages = campaign.messages as unknown as MessageWithStatus[]
    
    const stats = {
      total: messages.length,
      sent: messages.filter((m: MessageWithStatus) => m.status === 'SENT').length,
      delivered: messages.filter((m: MessageWithStatus) => m.status === 'DELIVERED').length,
      read: messages.filter((m: MessageWithStatus) => m.status === 'READ').length,
      failed: messages.filter((m: MessageWithStatus) => m.status === 'FAILED').length,
      pending: messages.filter((m: MessageWithStatus) => m.status === 'PENDING').length,
    }

    return NextResponse.json({ campaign, stats })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar campanha' },
      { status: 500 }
    )
  }
}

// PATCH - Atualizar campanha
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { name, message, status } = body

    const campaign = await prisma.campaign.findFirst({
      where: { id, userId }
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      )
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(message && { message }),
        ...(status && { status })
      }
    })

    return NextResponse.json({ campaign: updated })
  } catch (error) {
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar campanha' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar campanha
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId }
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      )
    }

    await prisma.campaign.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar campanha' },
      { status: 500 }
    )
  }
}