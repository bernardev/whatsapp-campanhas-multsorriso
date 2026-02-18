// workers/message-worker.ts
import { Worker, Job } from 'bullmq'
import { redis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { sendTextMessage } from '@/lib/evolution'
import { SendMessageJob } from '@/lib/queue'

// Worker que processa as mensagens
export const messageWorker = new Worker<SendMessageJob>(
  'messages',
  async (job: Job<SendMessageJob>) => {
    const { messageId, phone, message, instanceKey } = job.data

    console.log(`[Worker] Processando mensagem ${messageId} para ${phone}`)

    try {
      // Atualiza status para SENDING
      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'SENDING' }
      })

      // Envia via Evolution API
      const result = await sendTextMessage(instanceKey, phone, message)

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