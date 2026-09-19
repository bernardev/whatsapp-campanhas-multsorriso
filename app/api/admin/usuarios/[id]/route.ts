// app/api/admin/usuarios/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/auth'
import bcrypt from 'bcrypt'

interface RouteContext {
  params: Promise<{ id: string }>
}

// PATCH - Atualiza usuário (role, nome, senha)
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const auth = await authorize('ADMIN')
    if (!auth.ok) return auth.response

    const { id } = await context.params
    const body = await request.json()
    const { name, role, password } = body

    // Com a revalidação no banco, um ADMIN que rebaixa a si mesmo perde o acesso
    // na hora e pode deixar a clínica sem nenhum ADMIN.
    if (id === auth.user.id && role === 'USER') {
      return NextResponse.json(
        { error: 'Você não pode remover seu próprio acesso de administrador' },
        { status: 400 }
      )
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name
    if (role === 'ADMIN' || role === 'USER') updateData.role = role
    if (password) updateData.password = await bcrypt.hash(password, 10)

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLoginAt: true,
        createdAt: true
      }
    })

    console.log(`[Usuarios] Atualizado: ${updated.name} (${updated.email})`)

    return NextResponse.json({ user: updated })
  } catch (error) {
    console.error('[Usuarios] Erro ao atualizar:', error)
    return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 })
  }
}

// DELETE - Exclui usuário
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const auth = await authorize('ADMIN')
    if (!auth.ok) return auth.response
    const user = auth.user

    const { id } = await context.params

    // Não permite excluir a si mesmo
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Você não pode excluir sua própria conta' },
        { status: 400 }
      )
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    await prisma.user.delete({ where: { id } })

    console.log(`[Usuarios] Excluído: ${target.name} (${target.email})`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Usuarios] Erro ao excluir:', error)
    return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 })
  }
}
