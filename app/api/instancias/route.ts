// app/api/instancias/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import axios from 'axios'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://31.97.42.88:8082'
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || 'apikey321'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const instances = await prisma.whatsAppInstance.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ instances })
  } catch (error) {
    console.error('[Instances] Erro ao listar:', error)
    return NextResponse.json(
      { error: 'Erro ao listar instâncias' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    const instanceKey = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

    const response = await axios.post(
      `${EVOLUTION_URL}/instance/create`,
      {
        instanceName: instanceKey,
        token: EVOLUTION_KEY,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      },
      {
        headers: {
          'apikey': EVOLUTION_KEY,
          'Content-Type': 'application/json'
        }
      }
    )

    const qrCode = response.data?.qrcode?.base64 || null

    const instance = await prisma.whatsAppInstance.create({
      data: {
        name,
        instanceKey,
        status: 'disconnected',
        qrCode,
        userId: user.id
      }
    })

    console.log('[Instances] Criada:', instanceKey)

    // Configura webhook automaticamente
    try {
      const origin = request.headers.get('origin') || request.headers.get('referer')
      const webhookUrl = process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/evolution`
        : origin 
          ? `${origin}/api/webhooks/evolution`
          : 'http://localhost:3000/api/webhooks/evolution'
      
      await axios.post(
        `${EVOLUTION_URL}/webhook/set/${instanceKey}`,
        {
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: false,
            events: [
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'CONNECTION_UPDATE'
            ]
          }
        },
        {
          headers: {
            'apikey': EVOLUTION_KEY,
            'Content-Type': 'application/json'
          }
        }
      )
      
      console.log('[Webhook] Configurado automaticamente para:', instanceKey)
      console.log('[Webhook] URL:', webhookUrl)
    } catch (webhookError) {
      console.error('[Webhook] Erro ao configurar (não crítico):', webhookError)
    }

    return NextResponse.json({ instance })
  } catch (error) {
    console.error('[Instances] Erro ao criar:', error)
    return NextResponse.json(
      { error: 'Erro ao criar instância' },
      { status: 500 }
    )
  }
}