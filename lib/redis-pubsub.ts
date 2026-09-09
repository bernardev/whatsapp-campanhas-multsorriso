import { Redis } from 'ioredis'
import { redisTlsOptions } from './redis-tls'

// Cliente separado para publish (não pode ser o mesmo do subscribe)
export const redisPub = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  ...redisTlsOptions(),
})

// Cliente separado para subscribe
export const redisSub = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  ...redisTlsOptions(),
})

export const EVENTS_CHANNEL = 'whatsapp:eventos'
