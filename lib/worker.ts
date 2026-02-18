// lib/worker.ts
import { Worker, Job } from 'bullmq'
import { redis } from './redis'
import { sendTextMessage, sendImageMessage } from './evolution'
import { prisma } from './prisma'
import { SendMessageJob } from './queue'

export const messageWorker = new Worker<SendMessageJob>(
  'messages',
  async (job: Job<SendMessageJob>) => {
    const { messageId, phone, message, instanceKey } = job.data

    try {
      console.log(`[Worker] Enviando mensagem ${messageId} para ${phone}`)
      console.log(`[Worker] Usando instância: ${instanceKey}`)

      // Atualiza status para SENDING
      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'SENDING' },
      })

      // BUSCA A MENSAGEM PARA VER SE TEM IMAGEM
      const messageData = await prisma.message.findUnique({
        where: { id: messageId },
        select: { imageUrl: true }
      })

      let response

      // ENVIA IMAGEM OU TEXTO
      if (messageData?.imageUrl) {
        console.log(`[Worker] Mensagem com imagem: ${messageData.imageUrl}`)
        response = await sendImageMessage(instanceKey, phone, messageData.imageUrl, message)
      } else {
        console.log(`[Worker] Mensagem de texto`)
        response = await sendTextMessage(instanceKey, phone, message)
      }

      if (!response.success) {
        throw new Error(response.error || 'Erro ao enviar mensagem')
      }

      // Atualiza status para SENT
      await prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      })

      console.log(`[Worker] Mensagem ${messageId} enviada com sucesso`)
      return { success: true }
    } catch (error) {
      console.error(`❌ [Worker] Erro ao enviar mensagem ${messageId}:`, error)

      // Atualiza status para FAILED
      await prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          errorMsg: error instanceof Error ? error.message : 'Erro desconhecido',
        },
      })

      throw error
    }
  },
  {
    connection: redis,
    concurrency: 1,
    limiter: {
      max: parseInt(process.env.MESSAGES_PER_MINUTE || '20'),
      duration: 60000,
    },
  }
)

// Event listeners
messageWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completado`)
})

messageWorker.on('failed', (job, error) => {
  console.error(`[Worker] Job ${job?.id} falhou:`, error.message)
})

messageWorker.on('error', (error) => {
  console.error('[Worker] Erro no worker:', error)
})

console.log('[Worker] Worker de mensagens iniciado')