// app/api/contatos/[id]/route.ts
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

const updateContatoSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().regex(/^\+55\d{10,11}$/, 'Telefone inválido. Use o formato +5541999999999'),
  company: z.string().optional(),
})

// PATCH - Atualizar contato
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const validated = updateContatoSchema.parse(body)

    // Normaliza telefone (mantém só dígitos, igual ao POST)
    const normalizedPhone = validated.phone.replace(/\D/g, '')

    const existente = await prisma.contact.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { error: 'Contato não encontrado' },
        { status: 404 }
      )
    }

    // Impede colisão de telefone com OUTRO contato
    if (normalizedPhone !== existente.phone) {
      const duplicado = await prisma.contact.findFirst({
        where: { phone: normalizedPhone, NOT: { id } },
      })
      if (duplicado) {
        return NextResponse.json(
          { error: 'Já existe outro contato com este telefone' },
          { status: 400 }
        )
      }
    }

    const contato = await prisma.contact.update({
      where: { id },
      data: {
        name: validated.name,
        phone: normalizedPhone,
        company: validated.company || null,
      },
    })

    return NextResponse.json(contato)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar contato:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar contato' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar contato
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await context.params

    const existente = await prisma.contact.findUnique({ where: { id } })
    if (!existente) {
      return NextResponse.json(
        { error: 'Contato não encontrado' },
        { status: 404 }
      )
    }

    await prisma.contact.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar contato:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar contato' },
      { status: 500 }
    )
  }
}
