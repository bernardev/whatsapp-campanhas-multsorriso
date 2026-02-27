// app/api/conversas/[remoteJid]/enviar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: Promise<{ remoteJid: string }>
}

interface SendMessageBody {
  message: string
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

    const { remoteJid } = await context.params
    const body = await request.json() as SendMessageBody
    const { message } = body

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
    }

    // Envia pela Evolution API
    const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080'
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { 
        status: 'connected',
        isActive: true 
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!instance) {
      return NextResponse.json(
        { error: 'Nenhuma instância conectada' },
        { status: 400 }
      )
    }

    const instanceName = instance.instanceKey
    const apiKey = process.env.EVOLUTION_API_KEY

    console.log(`📤 [Send] Enviando para ${remoteJid}: "${message}"`)

    const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey || ''
      },
      body: JSON.stringify({
        number: remoteJid.replace('@s.whatsapp.net', ''),
        text: message
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ [Send] Erro da Evolution:', error)
      throw new Error('Erro ao enviar mensagem')
    }

    const result = await response.json()
    const messageId = result.key?.id || `msg_${Date.now()}`
    
    console.log(`✅ [Send] Mensagem enviada com sucesso! ID: ${messageId}`)

    // ✅ SALVA NO HISTÓRICO MANUALMENTE
    try {
      await prisma.conversationMessage.create({
        data: {
          instanceId: instance.id,
          messageId: messageId,
          remoteJid: remoteJid,
          fromMe: true,
          participant: null,
          pushName: user.name,
          messageText: message,
          messageType: 'conversation',
          timestamp: new Date(),
          source: 'web'
        }
      })
      console.log(`💾 [Send] Mensagem salva no histórico`)
    } catch (dbError) {
      console.error('⚠️ [Send] Erro ao salvar no histórico (pode já existir):', dbError)
    }

    return NextResponse.json({ 
      success: true,
      messageId: messageId
    })
  } catch (error) {
    console.error('❌ [Send] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao enviar mensagem' },
      { status: 500 }
    )
  }
}