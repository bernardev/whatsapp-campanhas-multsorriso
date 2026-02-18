// app/api/webhooks/evolution/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MessageStatus } from '@prisma/client'

// ========== TIPOS DO WEBHOOK ==========

interface WebhookBody {
  event: string
  instance: string
  data: WebhookData
}

interface WebhookData {
  key?: {
    id?: string
    remoteJid?: string
    fromMe?: boolean
    participant?: string
  }
  message?: {
    conversation?: string
    extendedTextMessage?: {
      text?: string
    }
    imageMessage?: {
      caption?: string
    }
  }
  messageType?: string
  messageTimestamp?: number
  status?: number
  pushName?: string
  source?: string
}

interface MessageUpdateData {
  status: MessageStatus
  sentAt?: Date
  deliveredAt?: Date
  readAt?: Date
  errorMsg?: string
}

// ========== CRIAR/ATUALIZAR LEAD AUTOMATICAMENTE ==========
async function createOrUpdateLead(remoteJid: string): Promise<void> {
  try {
    if (remoteJid.includes('status@broadcast')) return
    
    const phone = remoteJid
      .replace('@s.whatsapp.net', '')
      .replace('@g.us', '')
      .replace(/\D/g, '')
    
    console.log(`[Lead] Buscando campanha para telefone: ${phone}`)
    
    const phoneVariations = [
      phone,
      phone.slice(0, 4) + '9' + phone.slice(4)
    ]
    
    console.log(`[Lead] Variações de busca: ${phoneVariations.join(', ')}`)
    
    const lastCampaignMessage = await prisma.message.findFirst({
      where: { 
        contact: { 
          phone: {
            in: phoneVariations
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      select: { 
        campaignId: true,
        campaign: {
          select: {
            name: true
          }
        }
      }
    })
    
    if (lastCampaignMessage) {
      console.log(`[Lead] Campanha encontrada: ${lastCampaignMessage.campaign.name}`)
    } else {
      console.log(`[Lead] Nenhuma campanha encontrada para ${phone}`)
    }
    
    await prisma.lead.upsert({
      where: { remoteJid },
      create: {
        remoteJid,
        status: 'NOVO',
        isHot: false,
        campaignId: lastCampaignMessage?.campaignId || null
      },
      update: {
        updatedAt: new Date(),
        ...(lastCampaignMessage?.campaignId && { campaignId: lastCampaignMessage.campaignId })
      }
    })
    
    console.log(`[Lead] Criado/Atualizado: ${remoteJid}${lastCampaignMessage ? ` → Campanha: ${lastCampaignMessage.campaign.name}` : ' (sem campanha)'}`)
  } catch (error) {
    console.error('[Lead] Erro ao criar/atualizar:', error)
  }
}

// ========== HANDLER PRINCIPAL ==========

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as WebhookBody
    
    // Ignora instâncias antigas
    if (body.instance === 'teste-eduardo') {
      return NextResponse.json({ success: true })
    }
    
    console.log('[Webhook] Recebido:', JSON.stringify(body, null, 2))

    const { event, instance, data } = body

    if (event === 'messages.upsert') {
      await saveToConversationHistory(data, instance)
    }

    if (event === 'messages.update') {
      await handleMessageStatusUpdate(data, instance)
    }

    if (event === 'messages.upsert' && data.key?.fromMe === true) {
      await handleMessageSent(data, instance)
    }

    if (event === 'messages.upsert' && data.key?.fromMe === false) {
      await handleIncomingMessage(data, instance)
    }

    if (event === 'messages.upsert' && data.key?.fromMe === true) {
      await handleOutgoingMessage(data, instance)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    )
  }
}

// ========== SALVA TUDO NO HISTÓRICO ==========

async function saveToConversationHistory(
  data: WebhookData,
  instance: string
): Promise<void> {
  try {
    const messageId = data.key?.id
    const remoteJid = data.key?.remoteJid
    const fromMe = data.key?.fromMe ?? false
    const participant = data.key?.participant
    const pushName = data.pushName
    const messageType = data.messageType || 'unknown'
    const timestamp = data.messageTimestamp
    const source = data.source

    if (!messageId || !remoteJid || !timestamp) {
      console.log('[History] Dados insuficientes')
      return
    }

    const messageText = data.message?.conversation || 
                       data.message?.extendedTextMessage?.text ||
                       data.message?.imageMessage?.caption ||
                       '[Mídia ou mensagem não suportada]'

    let imageUrl: string | null = null
    if (messageType === 'imageMessage' && data.message?.imageMessage) {
      if (fromMe) {
        const phone = remoteJid
          .replace('@s.whatsapp.net', '')
          .replace('@g.us', '')
          .replace(/\D/g, '')
        
        const sentMessage = await prisma.message.findFirst({
          where: {
            contact: { phone },
            instanceId: instance,
            imageUrl: { not: null }
          },
          orderBy: { createdAt: 'desc' },
          select: { imageUrl: true }
        })
        
        if (sentMessage?.imageUrl) {
          imageUrl = sentMessage.imageUrl
        }
      }
    }

    const exists = await prisma.conversationMessage.findUnique({
      where: { messageId }
    })

    if (exists) {
      console.log('[History] Mensagem já existe:', messageId)
      return
    }

    await prisma.conversationMessage.create({
      data: {
        instanceId: instance,
        messageId,
        remoteJid,
        fromMe,
        participant,
        pushName,
        messageText,
        messageType,
        imageUrl,
        timestamp: new Date(timestamp * 1000),
        source
      }
    })

    console.log(`[History] Salvo: ${fromMe ? 'Você' : pushName || 'Contato'} → "${messageText.substring(0, 50)}"${imageUrl ? ' (imagem)' : ''}`)

    await createOrUpdateLead(remoteJid)
    
    if (!fromMe) {
      await prisma.conversationResponse.upsert({
        where: { remoteJid },
        create: {
          remoteJid,
          needsResponse: true,
          notificationRead: false,
          lastMessageAt: new Date(timestamp * 1000)
        },
        update: {
          needsResponse: true,
          notificationRead: false,
          lastMessageAt: new Date(timestamp * 1000),
          updatedAt: new Date()
        }
      })
      console.log(`[Response] Marcado como aguardando resposta: ${remoteJid}`)
    }
    
  } catch (error) {
    console.error('[History] Erro ao salvar:', error)
  }
}

// ========== ATUALIZA STATUS (ENTREGUE, LIDA, ERRO) ==========

async function handleMessageStatusUpdate(
  data: WebhookData, 
  instance: string
): Promise<void> {
  try {
    const remoteJid = data.key?.remoteJid?.replace('@s.whatsapp.net', '')
    const status = data.status

    if (!remoteJid || status === undefined) {
      console.log('[Webhook] Dados insuficientes para atualizar status')
      return
    }

    const phone = remoteJid.replace(/\D/g, '')

    const message = await prisma.message.findFirst({
      where: {
        contact: { phone },
        instanceId: instance,
        status: { in: ['PENDING', 'SENDING', 'SENT', 'DELIVERED'] }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!message) {
      console.log(`[Webhook] Mensagem não encontrada para ${phone}`)
      return
    }

    const updateData: Partial<MessageUpdateData> = {}
    let newStatus: MessageStatus | null = null

    switch (status) {
      case 0:
      case 1:
        newStatus = 'SENT'
        if (!message.sentAt) updateData.sentAt = new Date()
        break
      case 2:
        newStatus = 'DELIVERED'
        if (!message.deliveredAt) updateData.deliveredAt = new Date()
        break
      case 3:
        newStatus = 'READ'
        if (!message.readAt) updateData.readAt = new Date()
        break
      case 4:
        newStatus = 'FAILED'
        updateData.errorMsg = 'Erro no envio via WhatsApp'
        break
      default:
        console.log(`[Webhook] Status desconhecido: ${status}`)
        return
    }

    if (!newStatus) return

    updateData.status = newStatus

    await prisma.message.update({
      where: { id: message.id },
      data: updateData
    })

    console.log(`[Webhook] Status atualizado: ${message.id} → ${newStatus}`)
    await updateCampaignCounters(message.campaignId)
  } catch (error) {
    console.error('[Webhook] Erro ao atualizar status:', error)
  }
}

// ========== CONFIRMA MENSAGEM ENVIADA ==========

async function handleMessageSent(
  data: WebhookData, 
  instance: string
): Promise<void> {
  try {
    const messageKey = data.key?.id
    const remoteJid = data.key?.remoteJid?.replace('@s.whatsapp.net', '')

    if (!messageKey || !remoteJid) return

    const phone = remoteJid.replace(/\D/g, '')

    const message = await prisma.message.findFirst({
      where: {
        contact: { phone },
        instanceId: instance,
        status: 'SENDING'
      },
      orderBy: { createdAt: 'desc' }
    })

    if (message) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'SENT',
          sentAt: new Date()
        }
      })
      console.log(`[Webhook] Mensagem confirmada: ${message.id}`)
    }
  } catch (error) {
    console.error('[Webhook] Erro ao confirmar envio:', error)
  }
}

// ========== PROCESSA MENSAGEM RECEBIDA (RESPOSTA) ==========

async function handleIncomingMessage(
  data: WebhookData, 
  instance: string
): Promise<void> {
  try {
    const remoteJid = data.key?.remoteJid?.replace('@s.whatsapp.net', '')
    const pushName = data.pushName
    
    const messageText = data.message?.conversation || 
                        data.message?.extendedTextMessage?.text || ''

    if (!remoteJid || !messageText) return

    const phone = remoteJid.replace(/\D/g, '')
    console.log(`[Webhook] Resposta recebida de ${phone}: "${messageText}"`)

    const contact = await prisma.contact.findFirst({
      where: { phone }
    })

    if (!contact) {
      console.log(`[Webhook] Contato não está na base`)
      return
    }

    if (pushName && !contact.name) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { name: pushName }
      })
    }

    const blacklistWords: string[] = ['PARE', 'STOP', 'REMOVER', 'SAIR', 'CANCELAR']
    const detectedWord = blacklistWords.find((word: string) => 
      messageText.toUpperCase().includes(word)
    )

    if (detectedWord) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { 
          blacklisted: true,
          blacklistedAt: new Date(), 
          blacklistReason: detectedWord,
          blacklistedBy: 'auto' 
        }
      })
      console.log(`[Webhook] Contato bloqueado: ${phone} (palavra: ${detectedWord})`)
    }
  } catch (error) {
    console.error('[Webhook] Erro ao processar resposta:', error)
  }
}

async function handleOutgoingMessage(
  data: WebhookData,
  instance: string
): Promise<void> {
  try {
    const remoteJid = data.key?.remoteJid
    
    if (!remoteJid) return

    // Quando VOCÊ envia, marca a conversa como respondida
    await prisma.conversationResponse.updateMany({
      where: {
        remoteJid,
        needsResponse: true
      },
      data: {
        needsResponse: false,
        notificationRead: true,
        respondedAt: new Date()
      }
    })

    console.log(`[Webhook] Conversa marcada como respondida (você enviou): ${remoteJid}`)
  } catch (error) {
    console.error('[Webhook] Erro ao processar envio:', error)
  }
}

// ========== ATUALIZA CONTADORES DA CAMPANHA ==========

async function updateCampaignCounters(campaignId: string): Promise<void> {
  try {
    const messages = await prisma.message.findMany({
      where: { campaignId },
      select: { status: true }
    })

    const stats = {
      total: messages.length,
      sent: messages.filter((m) => ['SENT', 'DELIVERED', 'READ'].includes(m.status)).length,
      delivered: messages.filter((m) => ['DELIVERED', 'READ'].includes(m.status)).length,
      read: messages.filter((m) => m.status === 'READ').length,
      failed: messages.filter((m) => m.status === 'FAILED').length,
      pending: messages.filter((m) => ['PENDING', 'SENDING'].includes(m.status)).length,
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true, name: true }
    })

    if (!campaign) return

    let newStatus = campaign.status

    if (stats.pending === 0 && stats.total > 0) {
      if (campaign.status === 'RUNNING') {
        newStatus = 'COMPLETED'
      }
    }

    if (newStatus !== campaign.status) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: newStatus }
      })
      console.log(`[Webhook] Campanha "${campaign.name}" finalizada: ${stats.sent} enviadas, ${stats.failed} falhas`)
    }

    console.log(`[Webhook] Contadores:`, stats)
  } catch (error) {
    console.error('[Webhook] Erro ao atualizar contadores:', error)
  }
}