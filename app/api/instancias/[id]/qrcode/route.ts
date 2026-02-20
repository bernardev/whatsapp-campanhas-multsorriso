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

    console.log('[QRCode] Tentando conectar instância:', instance.instanceKey)

    // Tenta conectar (isso gera o QR Code se necessário)
    const connectResponse = await axios.get(
      `${EVOLUTION_URL}/instance/connect/${instance.instanceKey}`,
      {
        headers: { 'apikey': EVOLUTION_KEY },
        timeout: 30000
      }
    )

    console.log('[QRCode] Resposta da Evolution:', connectResponse.data)

    // Tenta diferentes formatos de resposta
    let qrCode = null
    
    if (connectResponse.data?.qrcode?.base64) {
      qrCode = connectResponse.data.qrcode.base64
    } else if (connectResponse.data?.base64) {
      qrCode = connectResponse.data.base64
    } else if (connectResponse.data?.pairingCode) {
      // Se for pairing code ao invés de QR
      console.log('[QRCode] Pairing code:', connectResponse.data.pairingCode)
    }

    // Se não retornou QR Code, busca da instância
    if (!qrCode && connectResponse.data?.count === 0) {
      console.log('[QRCode] Nenhum QR Code gerado ainda, tentando buscar...')
      
      // Aguarda 2 segundos e tenta novamente
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const retryResponse = await axios.get(
        `${EVOLUTION_URL}/instance/connect/${instance.instanceKey}`,
        {
          headers: { 'apikey': EVOLUTION_KEY }
        }
      )
      
      if (retryResponse.data?.qrcode?.base64) {
        qrCode = retryResponse.data.qrcode.base64
      }
    }

    if (qrCode) {
      await prisma.whatsAppInstance.update({
        where: { id },
        data: { 
          qrCode,
          status: 'connecting'
        }
      })
      
      console.log('[QRCode] QR Code gerado e salvo!')
      return NextResponse.json({ qrCode })
    }

    console.log('[QRCode] Nenhum QR Code disponível')
    return NextResponse.json(
      { error: 'QR Code não disponível. Tente novamente em alguns segundos.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[QRCode] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar QR Code' },
      { status: 500 }
    )
  }
}