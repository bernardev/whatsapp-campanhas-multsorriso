// app/api/instancias/[id]/qrcode/route.ts
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

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id }
    })

    if (!instance) {
      return NextResponse.json(
        { error: 'Instância não encontrada' },
        { status: 404 }
      )
    }

    const response = await axios.get(
      `${EVOLUTION_URL}/instance/connect/${instance.instanceKey}`,
      {
        headers: { 'apikey': EVOLUTION_KEY }
      }
    )

    const qrCode = response.data?.qrcode?.base64 || response.data?.base64 || null

    if (qrCode) {
      await prisma.whatsAppInstance.update({
        where: { id },
        data: { qrCode }
      })
    }

    console.log('[Instances] QR Code atualizado:', instance.instanceKey)

    return NextResponse.json({ qrCode })
  } catch (error) {
    console.error('[Instances] Erro ao gerar QR Code:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar QR Code' },
      { status: 500 }
    )
  }
}