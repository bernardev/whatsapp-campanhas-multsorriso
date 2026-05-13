// workers/message-worker.ts
import { Worker, Job } from 'bullmq'
import { redis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { sendTextMessage, sendTemplateMessage } from '@/lib/evolution'
import { SendMessageJob } from '@/lib/queue'

// Worker que processa as mensagens
export const messageWorker = new Worker<SendMessageJob>(
  'messages',
  async (job: Job<SendMessageJob>) => {
    const {
      messageId,
      phone,
      message,
      instanceKey,
      provider,
      templateName,
      templateLanguage,
      templateParams,
    } = job.data

    console.log(`[Worker] Processando mensagem ${messageId} para ${phone} (${provider || 'BAILEYS'})`)

    try {
      // Atualiza status para SENDING
      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'SENDING' }
      })

      // Roteamento: Cloud API exige template aprovado (Meta business-initiated).
      // Baileys aceita texto livre.
      const result =
        provider === 'CLOUD_API' && templateName && templateLanguage
          ? await sendTemplateMessage(
              instanceKey,
              phone,
              templateName,
              templateLanguage,
              templateParams || []
            )
          : await sendTextMessage(instanceKey, phone, message)

      if (result.success) {
        // Sucesso - atualiza para SENT
        await prisma.message.update({
          where: { id: messageId },
          data: {
            status: 'SENT',
            sentAt: new Date()
          }
        })
        console.log(`[Worker] ✅ Mensagem ${messageId} enviada com sucesso`)

        // Best-effort: registra outbound em ConversationMessage pra aparecer em /conversas.
        // Evolution v2 NÃO emite messages.upsert pra Cloud API; sem isso, /conversas fica vazio.
        // Falhas aqui não revertem o envio (Meta já aceitou) — só logam warning.
        if (provider === 'CLOUD_API') {
          try {
            const data = (result.data || {}) as {
              contacts?: Array<{ wa_id?: string }>
              messages?: Array<{ id?: string }>
            }
            const wamid = data.messages?.[0]?.id
            const waId = data.contacts?.[0]?.wa_id || phone

            if (wamid) {
              const instance = await prisma.whatsAppInstance.findUnique({
                where: { instanceKey },
                select: { id: true },
              })
              if (instance) {
                const templateText = templateName
                  ? `[template:${templateName}]${templateParams && templateParams.length ? ' ' + templateParams.join(' | ') : ''}`
                  : message
                await prisma.conversationMessage.upsert({
                  where: { messageId: wamid },
                  create: {
                    instanceId: instance.id,
                    messageId: wamid,
                    remoteJid: `${waId}@s.whatsapp.net`,
                    fromMe: true,
                    messageText: templateText,
                    messageType: 'template',
                    timestamp: new Date(),
                  },
                  update: {},
                })
              }
            }
          } catch (convErr) {
            console.warn(
              `[Worker] ⚠️ Falha ao registrar ConversationMessage (envio OK):`,
              convErr instanceof Error ? convErr.message : convErr
            )
          }
        }

        return { success: true }
      } else {
        // Falha - marca como FAILED
        await prisma.message.update({
          where: { id: messageId },
          data: {
            status: 'FAILED',
            errorMsg: result.error
          }
        })
        console.error(`[Worker] ❌ Falha ao enviar ${messageId}: ${result.error}`)
        throw new Error(result.error)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido'
      
      // Salva erro no banco
      await prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          errorMsg
        }
      })

      console.error(`[Worker] ❌ Erro ao processar ${messageId}:`, errorMsg)
      throw error // BullMQ vai tentar novamente
    }
  },
  {
    connection: redis,
    concurrency: 1, // Processa 1 mensagem por vez
    limiter: {
      max: parseInt(process.env.MESSAGES_PER_MINUTE || '20'), // 20 msgs/min
      duration: 60000 // 1 minuto
    }
  }
)

// Event listeners
messageWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completado`)
})

messageWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} falhou:`, err.message)
})

messageWorker.on('error', (err) => {
  console.error('[Worker] Erro no worker:', err)
})

console.log('✅ Message Worker iniciado')