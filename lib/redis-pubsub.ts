import { Redis } from 'ioredis'
import { redisTlsOptions } from './redis-tls'

// Cliente para publish (o subscribe usa um cliente dedicado por conexão SSE,
// criado em app/api/events/route.ts).
export const redisPub = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  ...redisTlsOptions(),
})

// Mantém o import atual do webhook funcionando (app/api/webhooks/evolution/route.ts)
export { EVENTS_CHANNEL } from './events-channel'
