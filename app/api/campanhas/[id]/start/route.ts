// app/api/campanhas/[id]/start/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { messageQueue } from '@/lib/queue'
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { instanceId } = body // ID da instância WhatsApp

    if (!instanceId) {
      return NextResponse.json(
        { error: 'Selecione uma instância WhatsApp' },
        { status: 400 }
      )
    }

    // Busca campanha
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        contacts: {
          include: {
            contact: true
          }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      )
    }

    // Busca instância WhatsApp
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId }
    })

    if (!instance || !instance.isActive) {
      return NextResponse.json(
        { error: 'Instância WhatsApp inválida ou inativa' },
        { status: 400 }
      )
    }

    // Atualiza status da campanha
    await prisma.campaign.update({
      where: { id },
      data: { status: 'RUNNING' }
    })

    // Cria mensagens e adiciona na fila
    let messagesCreated = 0

    const isCloud = instance.provider === 'CLOUD_API'
    const baseTemplateParams: string[] = Array.isArray(campaign.templateParams)
      ? (campaign.templateParams as string[])
      : []

    for (const campaignContact of campaign.contacts) {
      const contact = campaignContact.contact

      // Pula se estiver na blacklist
      if (contact.blacklisted) continue

      // Personaliza variáveis nas mensagens (Baileys) e nos params de template (Cloud)
      const personalize = (s: string): string =>
        s.replace(/\{nome\}/gi, contact.name || '').replace(/\{empresa\}/gi, contact.company || '')

      const personalizedMessage = personalize(campaign.message || '')
      const personalizedParams = baseTemplateParams.map(personalize)

      // Cria registro de mensagem
      const message = await prisma.message.create({
        data: {
          campaignId: campaign.id,
          contactId: contact.id,
          instanceId: instance.id,
          text: isCloud
            ? `[template:${campaign.templateName}] ${personalizedParams.join(' | ')}`
            : personalizedMessage,
          status: 'QUEUED'
        }
      })

      // Adiciona na fila
      await messageQueue.add(
        `message-${message.id}`,
        {
          messageId: message.id,
          campaignId: campaign.id,
          contactId: contact.id,
          instanceKey: instance.instanceKey,
          phone: contact.phone,
          message: personalizedMessage,
          provider: instance.provider,
          templateName: campaign.templateName || undefined,
          templateLanguage: campaign.templateLanguage || undefined,
          templateParams: isCloud ? personalizedParams : undefined,
        },
        {
          delay: messagesCreated * parseInt(process.env.DELAY_BETWEEN_MESSAGES || '3000')
        }
      )

      messagesCreated++
    }

    return NextResponse.json({
      success: true,
      messagesQueued: messagesCreated
    })

  } catch (error) {
    console.error('Error starting campaign:', error)
    return NextResponse.json(
      { error: 'Erro ao iniciar campanha' },
      { status: 500 }
    )
  }
}