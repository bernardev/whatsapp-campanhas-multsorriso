import { Redis } from 'ioredis'

// Cliente separado para publish (não pode ser o mesmo do subscribe)
export const redisPub = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
})

// Cliente separado para subscribe
export const redisSub = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
})

export const EVENTS_CHANNEL = 'whatsapp:eventos'