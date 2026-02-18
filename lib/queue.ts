// lib/queue.ts
import { Queue } from 'bullmq'
import { redis } from './redis'

export interface SendMessageJob {
  messageId: string
  campaignId: string
  contactId: string
  instanceKey: string
  phone: string
  message: string
}

// Cria a fila de mensagens
export const messageQueue = new Queue<SendMessageJob>('messages', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3, // Tenta 3 vezes se falhar
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 segundos entre tentativas
    },
    removeOnComplete: {
      count: 100, // Mantém últimos 100 jobs completados
    },
    removeOnFail: {
      count: 500, // Mantém últimos 500 jobs com falha
    },
  },
})

console.log('Message queue initialized')