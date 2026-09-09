// lib/redis.ts
import { Redis } from 'ioredis'
import 'dotenv/config'
import { redisTlsOptions } from './redis-tls'

// Nunca logar a URL crua: ela contém a senha do Redis.
const maskedUrl = (process.env.REDIS_URL || '').replace(/\/\/[^@]*@/, '//***@')
console.log('[Redis] Connecting to:', maskedUrl)

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  ...redisTlsOptions(),
})

redis.on('error', (err) => {
  console.error('Redis connection error:', err)
})

redis.on('connect', () => {
  console.log('Redis connected successfully')
})

export { redis }
