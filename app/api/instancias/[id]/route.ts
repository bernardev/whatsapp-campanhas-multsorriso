// app/api/instancias/[id]/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import axios from 'axios'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://31.97.42.88:8082'
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || 'apikey321'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await context.params

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id }
    })

    if (!instance) {
      return NextResponse.json(
        { error: 'Instância não encontrada' },
        { status: 404 }
      )
    }

    try {
      const statusResponse = await axios.get(
        `${EVOLUTION_URL}/instance/connectionState/${instance.instanceKey}`,
        {
          headers: { 'apikey': EVOLUTION_KEY }
        }
      )

      const state = statusResponse.data?.instance?.state || 'close'
      const status = state === 'open' ? 'connected' : 'disconnected'

      await prisma.whatsAppInstance.update({
        where: { id },
        data: { status }
      })

      return NextResponse.json({ instance: { ...instance, status } })
    } catch {
      return NextResponse.json({ instance })
    }
  } catch (error) {
    console.error('[Instances] Erro ao buscar:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar instância' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await context.params

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id }
    })

    if (!instance) {
      return NextResponse.json(
        { error: 'Instância não encontrada' },
        { status: 404 }
      )
    }

    // Tenta deletar da Evolution
    try {
      await axios.delete(
        `${EVOLUTION_URL}/instance/delete/${instance.instanceKey}`,
        {
          headers: { 'apikey': EVOLUTION_KEY }
        }
      )
      console.log('[Instances] Deletada da Evolution')
    } catch {
      console.log('[Instances] Instância já deletada da Evolution')
    }

    // Soft delete: marca como inativa ao invés de deletar do banco
    await prisma.whatsAppInstance.update({
      where: { id },
      data: { 
        isActive: false,
        status: 'deleted'
      }
    })

    console.log('[Instances] Marcada como deletada:', instance.instanceKey)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Instances] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar instância' },
      { status: 500 }
    )
  }
}