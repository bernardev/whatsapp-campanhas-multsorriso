// app/api/campanhas/[id]/stream/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface CampaignStats {
  total: number
  pending: number
  sending: number
  sent: number
  delivered: number
  read: number
  failed: number
  responded: number
}

// Telefones BR podem ter ou não o 9º dígito (após 55 + DDD). Gera as duas
// formas para casar o telefone do contato com o remoteJid das conversas.
function digitVariants(digits: string): string[] {
  const set = new Set<string>([digits])
  if (digits.length === 12) {
    set.add(digits.slice(0, 4) + '9' + digits.slice(4))
  }
  if (digits.length === 13 && digits[4] === '9') {
    set.add(digits.slice(0, 4) + digits.slice(5))
  }
  return [...set]
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: campaignId } = await context.params

  if (!campaignId) {
    return new Response('Campaign ID is required', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let intervalId: NodeJS.Timeout | null = null

      const sendUpdate = async (): Promise<void> => {
        try {
          const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
              messages: {
                include: { contact: true },
                orderBy: { createdAt: 'desc' },
              },
            },
          })

          if (!campaign) {
            controller.close()
            if (intervalId) clearInterval(intervalId)
            return
          }

          // Descobre quais contatos responderam após o início da campanha:
          // casa o telefone do contato com o remoteJid das mensagens recebidas.
          const jidsByMessage = new Map<string, string[]>()
          const allJids = new Set<string>()
          for (const msg of campaign.messages) {
            const digits = msg.contact.phone.replace(/\D/g, '')
            const jids = digitVariants(digits).map((v) => `${v}@s.whatsapp.net`)
            jidsByMessage.set(msg.id, jids)
            jids.forEach((j) => allJids.add(j))
          }

          const respondedJids = new Set<string>()
          if (allJids.size > 0) {
            const inbound = await prisma.conversationMessage.findMany({
              where: {
                remoteJid: { in: [...allJids] },
                fromMe: false,
                timestamp: { gte: campaign.createdAt },
              },
              select: { remoteJid: true },
            })
            inbound.forEach((m) => respondedJids.add(m.remoteJid))
          }

          const messages = campaign.messages.map((msg) => ({
            id: msg.id,
            phone: msg.contact.phone,
            name: msg.contact.name,
            status: msg.status,
            sentAt: msg.sentAt,
            deliveredAt: msg.deliveredAt,
            readAt: msg.readAt,
            errorMsg: msg.errorMsg,
            createdAt: msg.createdAt,
            responded: (jidsByMessage.get(msg.id) || []).some((j) =>
              respondedJids.has(j)
            ),
          }))

          const stats: CampaignStats = {
            total: messages.length,
            pending: messages.filter((m) => m.status === 'PENDING').length,
            sending: messages.filter((m) => m.status === 'SENDING').length,
            sent: messages.filter((m) => m.status === 'SENT').length,
            delivered: messages.filter((m) => m.status === 'DELIVERED').length,
            read: messages.filter((m) => m.status === 'READ').length,
            failed: messages.filter((m) => m.status === 'FAILED').length,
            responded: messages.filter((m) => m.responded).length,
          }

          const data = JSON.stringify({
            campaign: {
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              createdAt: campaign.createdAt,
              templateName: campaign.templateName,
            },
            stats,
            messages,
          })

          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch (error) {
          console.error('❌ [SSE] Erro ao enviar update:', error)
          controller.error(error)
          if (intervalId) clearInterval(intervalId)
        }
      }

      await sendUpdate()
      intervalId = setInterval(sendUpdate, 2000)

      request.signal.addEventListener('abort', () => {
        if (intervalId) clearInterval(intervalId)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
