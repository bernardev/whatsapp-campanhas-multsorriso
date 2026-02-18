// app/api/contatos/[id]/desbloquear/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await context.params

    const contact = await prisma.contact.findUnique({
      where: { id }
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contato não encontrado' },
        { status: 404 }
      )
    }

    await prisma.contact.update({
      where: { id },
      data: {
        blacklisted: false,
        blacklistedAt: null,
        blacklistReason: null,
        blacklistedBy: null
      }
    })

    console.log('[Blacklist] Contato desbloqueado:', contact.phone)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Blacklist] Erro ao desbloquear:', error)
    return NextResponse.json(
      { error: 'Erro ao desbloquear contato' },
      { status: 500 }
    )
  }
}