// app/api/campanhas/[id]/enviar/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { messageQueue } from '@/lib/queue'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'seu-secret-super-seguro'
)

async function getUserFromToken(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('auth-token')?.value
  if (!token) return null
  
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload.userId as string
  } catch {
    return null
  }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const userId = await getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const params = await context.params
    const campaignId = params.id

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        contacts: {
          include: {
            contact: true,
          },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    }

    if (campaign.userId !== userId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    if (campaign.status === 'RUNNING') {
      return NextResponse.json({ error: 'Campanha já está em execução' }, { status: 400 })
    }

    const instances = await prisma.whatsAppInstance.findMany({
      where: {
        status: 'connected',
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    })

    if (instances.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma instância conectada. Conecte uma instância em /instancias' },
        { status: 400 }
      )
    }

    const isCloud = !!campaign.templateName
    const cloudInstance = isCloud
      ? instances.find(i => i.provider === 'CLOUD_API')
      : null
    const baileysInstances = isCloud
      ? []
      : instances.filter(i => i.provider !== 'CLOUD_API')

    if (isCloud && !cloudInstance) {
      return NextResponse.json(
        { error: 'Campanha Cloud API requer uma instância CLOUD_API conectada' },
        { status: 400 }
      )
    }
    if (!isCloud && baileysInstances.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma instância Baileys conectada' },
        { status: 400 }
      )
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    })

    const usedInstances = isCloud ? [cloudInstance!] : baileysInstances
    console.log(`[Campaign] Iniciando envio: ${campaign.name}${campaign.imageUrl ? ' (com imagem)' : ''}${isCloud ? ` (Cloud API template: ${campaign.templateName})` : ''}`)
    console.log(`[Campaign] Usando ${usedInstances.length} instância(s): ${usedInstances.map(i => `${i.name} (${i.instanceKey})`).join(', ')}`)

    const baseTemplateParams: string[] = Array.isArray(campaign.templateParams)
      ? (campaign.templateParams as string[])
      : []

    let messagesCreated = 0

    for (const campaignContact of campaign.contacts) {
      const contact = campaignContact.contact

      if (contact.blacklisted) continue

      const instance = isCloud
        ? cloudInstance!
        : baileysInstances[messagesCreated % baileysInstances.length]

      const personalize = (s: string): string =>
        s.replace(/\{nome\}/gi, contact.name || 'Cliente').replace(/\{empresa\}/gi, contact.company || '')

      const personalizedMessage = personalize(campaign.message || '')
      const personalizedParams = baseTemplateParams.map(personalize)

      const message = await prisma.message.create({
        data: {
          campaignId: campaign.id,
          contactId: contact.id,
          instanceId: instance.id,
          text: isCloud
            ? `[template:${campaign.templateName}] ${personalizedParams.join(' | ')}`.trim()
            : personalizedMessage,
          imageUrl: !isCloud ? (campaign.imageUrl || null) : null,
          status: 'PENDING',
        },
      })

      await messageQueue.add(
        'send-message',
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
          delay: messagesCreated * parseInt(process.env.DELAY_BETWEEN_MESSAGES || '3000'),
        }
      )

      messagesCreated++
    }

    console.log(`[Campaign] ${messagesCreated} mensagens na fila`)

    return NextResponse.json({
      success: true,
      messagesQueued: messagesCreated,
    })
  } catch (error) {
    console.error('[Campaign] Erro ao iniciar campanha:', error)
    return NextResponse.json(
      { error: 'Erro ao iniciar campanha' },
      { status: 500 }
    )
  }
}