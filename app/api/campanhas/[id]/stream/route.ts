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
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } // ✅ Promise!
): Promise<Response> {
  // ✅ Await params!
  const { id: campaignId } = await context.params

  console.log('📡 [SSE] Iniciando stream para campanha:', campaignId)

  if (!campaignId) {
    return new Response('Campaign ID is required', { status: 400 })
  }

  // Cria stream SSE
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      let intervalId: NodeJS.Timeout | null = null
      
      // Função para enviar dados
      const sendUpdate = async (): Promise<void> => {
        try {
          console.log('🔄 [SSE] Buscando dados da campanha:', campaignId)
          
          // Busca campanha
          const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
              messages: {
                include: {
                  contact: true
                },
                orderBy: {
                  createdAt: 'desc'
                }
              }
            }
          })

          if (!campaign) {
            console.error('❌ [SSE] Campanha não encontrada:', campaignId)
            controller.close()
            if (intervalId) clearInterval(intervalId)
            return
          }

          // Calcula estatísticas
          const stats: CampaignStats = {
            total: campaign.messages.length,
            pending: campaign.messages.filter(m => m.status === 'PENDING').length,
            sending: campaign.messages.filter(m => m.status === 'SENDING').length,
            sent: campaign.messages.filter(m => m.status === 'SENT').length,
            delivered: campaign.messages.filter(m => m.status === 'DELIVERED').length,
            read: campaign.messages.filter(m => m.status === 'READ').length,
            failed: campaign.messages.filter(m => m.status === 'FAILED').length,
          }

          // Formata mensagens
          const messages = campaign.messages.map(msg => ({
            id: msg.id,
            phone: msg.contact.phone,
            name: msg.contact.name,
            status: msg.status,
            sentAt: msg.sentAt,
            deliveredAt: msg.deliveredAt,
            readAt: msg.readAt,
            errorMsg: msg.errorMsg,
            createdAt: msg.createdAt
          }))

          // Envia dados via SSE
          const data = JSON.stringify({
            campaign: {
              id: campaign.id,
              name: campaign.name,
              status: campaign.status
            },
            stats,
            messages
          })

          controller.enqueue(
            encoder.encode(`data: ${data}\n\n`)
          )

          console.log('✅ [SSE] Update enviado:', stats)
        } catch (error) {
          console.error('❌ [SSE] Erro ao enviar update:', error)
          controller.error(error)
          if (intervalId) clearInterval(intervalId)
        }
      }

      // Envia primeiro update
      await sendUpdate()

      // Atualiza a cada 2 segundos
      intervalId = setInterval(sendUpdate, 2000)

      // Limpa ao fechar conexão
      request.signal.addEventListener('abort', () => {
        console.log('🔌 [SSE] Conexão fechada pelo cliente')
        if (intervalId) clearInterval(intervalId)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}