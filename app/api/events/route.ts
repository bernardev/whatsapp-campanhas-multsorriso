import { NextRequest } from 'next/server'
import { Redis } from 'ioredis'
import { EVENTS_CHANNEL } from '@/lib/redis-pubsub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Cria cliente subscriber dedicado para esta conexão
      const subscriber = new Redis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null,
        tls: { rejectUnauthorized: false }
      })

      // Envia ping a cada 30s para manter conexão viva
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(keepAlive)
        }
      }, 30000)

      subscriber.subscribe(EVENTS_CHANNEL, (err) => {
        if (err) {
          console.error('[SSE] Erro ao subscrever:', err)
          controller.close()
          return
        }
        console.log('[SSE] Cliente conectado')
      })

      subscriber.on('message', (_channel, message) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`))
        } catch {
          // Cliente desconectou
        }
      })

      // Cleanup quando cliente desconecta
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        subscriber.unsubscribe()
        subscriber.quit()
        controller.close()
        console.log('[SSE] Cliente desconectado')
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  })
}