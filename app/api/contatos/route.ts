// app/api/contatos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authorize, getUserIdFromRequest } from '@/lib/auth'

const contatoSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().regex(/^\+55\d{10,11}$/, 'Telefone inválido. Use o formato +5541999999999'),
  company: z.string().optional(),
})

// POST - Criar contato individual
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = contatoSchema.parse(body)

    // Normaliza telefone (remove caracteres)
    const normalizedPhone = validated.phone.replace(/\D/g, '')

    // Verifica duplicado
    const existente = await prisma.contact.findFirst({
      where: { phone: normalizedPhone }
    })

    if (existente) {
      return NextResponse.json(
        { error: 'Contato já cadastrado com este telefone' },
        { status: 400 }
      )
    }

    // Cria contato
    const contato = await prisma.contact.create({
      data: {
        name: validated.name,
        phone: normalizedPhone,
        company: validated.company || null,
      },
    })

    return NextResponse.json(contato, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao criar contato:', error)
    return NextResponse.json(
      { error: 'Erro ao criar contato' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar contato
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authorize('ADMIN')  // destrutivo: só ADMIN (F4 B2)
    if (!auth.ok) return auth.response
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID não fornecido' },
        { status: 400 }
      )
    }

    await prisma.contact.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar contato:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar contato' },
      { status: 500 }
    )
  }
}