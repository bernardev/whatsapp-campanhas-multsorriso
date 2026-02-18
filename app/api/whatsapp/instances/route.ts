// app/api/whatsapp/instances/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkInstanceStatus } from '@/lib/evolution'
import { jwtVerify } from 'jose'

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

// GET - Listar instâncias
export async function GET(request: NextRequest) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const instances = await prisma.whatsAppInstance.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ instances })
  } catch (error) {
    console.error('Error fetching instances:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar instâncias' },
      { status: 500 }
    )
  }
}

// POST - Criar instância
export async function POST(request: NextRequest) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, instanceKey, phone } = body

    if (!name || !instanceKey || !phone) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    // Verifica se instância existe na Evolution API
    const statusCheck = await checkInstanceStatus(instanceKey)
    
    if (!statusCheck.success) {
      return NextResponse.json(
        { error: 'Instância não encontrada na Evolution API' },
        { status: 400 }
      )
    }

    // Cria no banco
    const instance = await prisma.whatsAppInstance.create({
      data: {
        name,
        instanceKey,
        phone,
        isActive: true
      }
    })

    return NextResponse.json({ instance }, { status: 201 })
  } catch (error) {
    console.error('Error creating instance:', error)
    return NextResponse.json(
      { error: 'Erro ao criar instância' },
      { status: 500 }
    )
  }
}