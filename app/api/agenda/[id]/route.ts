// app/api/agenda/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import { z } from 'zod'

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

interface RouteContext {
  params: Promise<{ id: string }>
}

const updateSchema = z.object({
  contactId: z.string().min(1).optional(),
  scheduledFor: z.string().min(1).optional(),
  professional: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z
    .enum(['AGENDADO', 'CONFIRMADO', 'CANCELADO', 'REALIZADO', 'FALTOU'])
    .optional(),
})

// PATCH - Atualiza agendamento (reagendar, mudar status, editar dados)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existente = await prisma.appointment.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { error: 'Agendamento não encontrado' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (data.contactId) updateData.contactId = data.contactId
    if (data.professional !== undefined)
      updateData.professional = data.professional?.trim() || null
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null
    if (data.status) updateData.status = data.status

    // Se reagendou, reinterpreta o horário como SP e zera os carimbos de lembrete
    // para que os avisos voltem a ser enviados para a nova data.
    if (data.scheduledFor) {
      const scheduledFor = new Date(`${data.scheduledFor}:00-03:00`)
      if (Number.isNaN(scheduledFor.getTime())) {
        return NextResponse.json(
          { error: 'Data/horário inválido' },
          { status: 400 }
        )
      }
      updateData.scheduledFor = scheduledFor
      updateData.lembreteVesperaEnviadoEm = null
      updateData.lembreteDiaEnviadoEm = null
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
      },
    })

    return NextResponse.json({ appointment })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Erro ao atualizar agendamento:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar agendamento' },
      { status: 500 }
    )
  }
}

// DELETE - Remove o agendamento
export async function DELETE(request: NextRequest, context: RouteContext) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const existente = await prisma.appointment.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { error: 'Agendamento não encontrado' },
        { status: 404 }
      )
    }
    await prisma.appointment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir agendamento:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir agendamento' },
      { status: 500 }
    )
  }
}
