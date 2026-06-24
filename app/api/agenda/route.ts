// app/api/agenda/route.ts
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

// GET - Lista agendamentos num intervalo (?from=ISO&to=ISO).
// Sem intervalo, retorna os próximos 90 dias a partir de hoje.
export async function GET(request: NextRequest) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    const from = fromParam ? new Date(fromParam) : new Date()
    const to = toParam
      ? new Date(toParam)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

    const appointments = await prisma.appointment.findMany({
      where: { scheduledFor: { gte: from, lte: to } },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { scheduledFor: 'asc' },
    })

    return NextResponse.json({ appointments })
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error)
    return NextResponse.json(
      { error: 'Erro ao listar agendamentos' },
      { status: 500 }
    )
  }
}

const createSchema = z.object({
  contactId: z.string().min(1, 'Selecione um contato'),
  // datetime-local do navegador: "2026-06-25T14:00" (horário de SP)
  scheduledFor: z.string().min(1, 'Informe data e horário'),
  professional: z.string().optional(),
  notes: z.string().optional(),
})

// POST - Cria um agendamento de avaliação
export async function POST(request: NextRequest) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = createSchema.parse(body)

    const contact = await prisma.contact.findUnique({
      where: { id: data.contactId },
    })
    if (!contact) {
      return NextResponse.json(
        { error: 'Contato não encontrado' },
        { status: 404 }
      )
    }

    // O input "datetime-local" não traz fuso. Interpretamos como horário de SP (-03:00).
    const scheduledFor = new Date(`${data.scheduledFor}:00-03:00`)
    if (Number.isNaN(scheduledFor.getTime())) {
      return NextResponse.json(
        { error: 'Data/horário inválido' },
        { status: 400 }
      )
    }

    // Instância CLOUD_API conectada (origem dos lembretes via template)
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { provider: 'CLOUD_API' },
      orderBy: { status: 'asc' }, // 'connected' antes de 'disconnected'
    })

    const appointment = await prisma.appointment.create({
      data: {
        contactId: data.contactId,
        scheduledFor,
        professional: data.professional?.trim() || null,
        notes: data.notes?.trim() || null,
        instanceId: instance?.id || null,
        createdByUserId: userId,
      },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
      },
    })

    return NextResponse.json({ appointment }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Erro ao criar agendamento:', error)
    return NextResponse.json(
      { error: 'Erro ao criar agendamento' },
      { status: 500 }
    )
  }
}
