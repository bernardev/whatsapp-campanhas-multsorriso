import { Redis } from 'ioredis'

// Cliente separado para publish (não pode ser o mesmo do subscribe)
export const redisPub = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: { rejectUnauthorized: false }
})

// Cliente separado para subscribe
export const redisSub = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: { rejectUnauthorized: false }
})

export const EVENTS_CHANNEL = 'whatsapp:eventos'