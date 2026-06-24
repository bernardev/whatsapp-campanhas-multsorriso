// workers/reminder-worker.ts
// Agenda um job recorrente (todo dia às 8h, fuso de SP) e processa-o
// disparando os lembretes de avaliação. Roda no mesmo processo do worker
// de mensagens (importado por workers/message-worker.ts).
import { Queue, Worker, Job } from 'bullmq'
import { redis } from '@/lib/redis'
import { runDailyReminders } from '@/lib/reminders'
import { TZ } from '@/lib/agenda'

const QUEUE_NAME = 'reminders'
const JOB_NAME = 'daily-reminders'

export const remindersQueue = new Queue(QUEUE_NAME, { connection: redis })

// Registra (idempotente) o agendamento recorrente: 08:00 todo dia, horário de SP.
export async function scheduleDailyReminders(): Promise<void> {
  // upsertJobScheduler substitui qualquer agendamento anterior de mesmo id.
  await remindersQueue.upsertJobScheduler(
    JOB_NAME,
    { pattern: '0 8 * * *', tz: TZ },
    { name: JOB_NAME, data: {} }
  )
  console.log(`[Lembretes] Agendamento diário registrado (08:00 ${TZ})`)
}

export const reminderWorker = new Worker(
  QUEUE_NAME,
  async (_job: Job) => {
    console.log('[Lembretes] Disparando rotina diária...')
    return await runDailyReminders()
  },
  {
    connection: redis,
    concurrency: 1,
  }
)

reminderWorker.on('completed', (job) => {
  console.log(`[Lembretes] Job ${job.id} concluído`)
})
reminderWorker.on('failed', (job, err) => {
  console.error(`[Lembretes] Job ${job?.id} falhou:`, err.message)
})
reminderWorker.on('error', (err) => {
  console.error('[Lembretes] Erro no worker:', err)
})

// Garante o agendamento ao subir o processo.
scheduleDailyReminders().catch((err) =>
  console.error('[Lembretes] Falha ao registrar agendamento:', err)
)
