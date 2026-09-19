// app/api/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Redis } from 'ioredis'
import { getVerifiedUser } from '@/lib/auth'
import { EVENTS_CHANNEL } from '@/lib/events-channel'
import { redisTlsOptions } from '@/lib/redis-tls'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Teto da função na Vercel. O próprio stream se encerra antes (MAX_STREAM_MS)
// para o cleanup rodar sempre; o EventSource do navegador reconecta sozinho
// (e reautentica a cada reconexão).
export const maxDuration = 60

const KEEPALIVE_MS = 25_000
const MAX_STREAM_MS = 55_000
const RETRY_MS = 3_000

export async function GET(request: NextRequest): Promise<Response> {
  // 1) Autentica ANTES de criar qualquer recurso (Redis, timers, stream).
  //    Anônimo recebe 401 imediato e nenhuma conexão Redis é aberta.
  //    Revalidado no banco (F4): usuário excluído perde o acesso na hora.
  const user = await getVerifiedUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const userId = user.id

  const encoder = new TextEncoder()
  let cleanup: () => void = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Subscriber dedicado: em modo subscribe o cliente não aceita outros comandos
      const subscriber = new Redis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null,
        ...redisTlsOptions(),
      })

      let closed = false
      let keepAlive: ReturnType<typeof setInterval> | undefined
      let lifetime: ReturnType<typeof setTimeout> | undefined

      cleanup = () => {
        if (closed) return // idempotente: abort, cancel, erro e timeout podem coincidir
        closed = true
        if (keepAlive) clearInterval(keepAlive)
        if (lifetime) clearTimeout(lifetime)
        request.signal.removeEventListener('abort', cleanup)
        subscriber.removeAllListeners('message')
        // disconnect() é síncrono, não devolve Promise (sem unhandledRejection
        // se o Redis já caiu) e desliga a reconexão automática do ioredis.
        subscriber.disconnect()
        try {
          controller.close()
        } catch {
          // stream já fechado/cancelado pelo cliente
        }
        console.log(`[SSE] Cliente desconectado (user ${userId})`)
      }

      const send = (chunk: string): void => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup() // enqueue falhou = cliente foi embora
        }
      }

      subscriber.on('error', (err: Error) => {
        console.error('[SSE] Erro no Redis:', err.message)
      })

      subscriber.on('message', (_channel: string, message: string) => {
        send(`data: ${message}\n\n`)
      })

      subscriber.subscribe(EVENTS_CHANNEL, (err) => {
        // Se o cliente já saiu antes do SUBSCRIBE responder, o disconnect()
        // devolve 'Connection is closed' aqui: não é erro real, ignora.
        if (closed) return
        if (err) {
          console.error('[SSE] Erro ao subscrever:', err)
          cleanup() // antes: fechava o stream mas deixava a conexão Redis aberta
          return
        }
        console.log(`[SSE] Cliente conectado (user ${userId})`)
      })

      // Instrui o EventSource a reconectar em 3s quando o servidor encerrar
      send(`retry: ${RETRY_MS}\n\n`)

      keepAlive = setInterval(() => send(': ping\n\n'), KEEPALIVE_MS)
      lifetime = setTimeout(cleanup, MAX_STREAM_MS)

      if (request.signal.aborted) {
        cleanup()
      } else {
        request.signal.addEventListener('abort', cleanup, { once: true })
      }
    },
    // Chamado quando o consumidor cancela o body (desconexão do cliente).
    // O código original só ouvia request.signal 'abort'.
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
