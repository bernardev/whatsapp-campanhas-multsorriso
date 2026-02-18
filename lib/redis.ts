// lib/redis.ts
import { Redis } from 'ioredis'
import 'dotenv/config'

console.log('[Redis] Connecting to:', process.env.REDIS_URL)
const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: {
    rejectUnauthorized: false
  }
})

redis.on('error', (err) => {
  console.error('Redis connection error:', err)
})

redis.on('connect', () => {
  console.log('Redis connected successfully')
})

export { redis }