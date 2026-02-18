// app/api/campanhas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'seu-secret-super-seguro'
)

// Função helper para pegar usuário do token
async function getUserFromToken(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  
  if (!token) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload.userId as string
  } catch {
    return null
  }
}

// GET - Listar campanhas do usuário
export async function GET(request: NextRequest) {
  const userId = await getUserFromToken(request)

  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            contacts: true,
            messages: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar campanhas' },
      { status: 500 }
    )
  }
}

// POST - Criar nova campanha
export async function POST(request: NextRequest) {
  const userId = await getUserFromToken(request)

  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, message, scheduledAt, contactIds, imageUrl } = body  // ✅ NOVO: imageUrl

    // Validações
    if (!name || !message) {
      return NextResponse.json(
        { error: 'Nome e mensagem são obrigatórios' },
        { status: 400 }
      )
    }

    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'Selecione pelo menos um contato' },
        { status: 400 }
      )
    }

    // Cria campanha
    const campaign = await prisma.campaign.create({
      data: {
        name,
        message,
        imageUrl: imageUrl || null,  // ✅ NOVO: Salva imageUrl
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        userId,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
        contacts: {
          create: contactIds.map((contactId: string) => ({
            contactId
          }))
        }
      },
      include: {
        contacts: {
          include: {
            contact: true
          }
        }
      }
    })

    console.log(`✅ [Campaign] Criada: ${campaign.name}${imageUrl ? ' (com imagem)' : ''}`)

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: 'Erro ao criar campanha' },
      { status: 500 }
    )
  }
}