// app/api/contatos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { authorize, getUserIdFromRequest } from '@/lib/auth'

const contatoSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().regex(/^\+55\d{10,11}$/, 'Telefone inválido. Use o formato +5541999999999'),
  company: z.string().optional(),
})

// GET - Lista paginada, com busca e contagens resolvidas no banco.
// Antes a tela carregava os 7.000+ contatos de uma vez e filtrava no navegador:
// 1,5 MB a cada visita, só para mostrar 50 linhas.
const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const auth = await authorize()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') === 'blacklist' ? 'blacklist' : 'all'
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

    const where: Prisma.ContactWhereInput = {
      blacklisted: tab === 'blacklist',
      ...(q
        ? {
            OR: [
              { phone: { contains: q } },
              { name: { contains: q, mode: 'insensitive' as const } },
              { company: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [contatos, total, ativos, blacklist] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, phone: true, name: true, company: true,
          blacklisted: true, blacklistedAt: true, blacklistReason: true,
          blacklistedBy: true, createdAt: true,
        },
      }),
      prisma.contact.count({ where }),
      prisma.contact.count({ where: { blacklisted: false } }),
      prisma.contact.count({ where: { blacklisted: true } }),
    ])

    return NextResponse.json({
      contatos,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts: { ativos, blacklist, todos: ativos + blacklist },
    })
  } catch (error) {
    console.error('Erro ao listar contatos:', error)
    return NextResponse.json({ error: 'Erro ao listar contatos' }, { status: 500 })
  }
}

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