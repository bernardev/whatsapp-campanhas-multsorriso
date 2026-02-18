// app/api/notificacoes/marcar-lidas/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { remoteJids } = body

    if (!remoteJids || !Array.isArray(remoteJids)) {
      return NextResponse.json(
        { error: 'remoteJids inválido' },
        { status: 400 }
      )
    }

    // Marca apenas como lida (remove do sino)
    // MAS mantém needsResponse = true (continua em /conversas)
    await prisma.conversationResponse.updateMany({
      where: {
        remoteJid: { in: remoteJids },
        needsResponse: true
      },
      data: {
        notificationRead: true
      }
    })

    console.log('[Notificacoes] Marcadas como lidas:', remoteJids.length)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Notificacoes] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao marcar como lidas' },
      { status: 500 }
    )
  }
}