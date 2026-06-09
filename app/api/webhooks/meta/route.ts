// app/api/webhooks/meta/route.ts
//
// Recebe webhooks da Meta Cloud API (WhatsApp Business).
// - GET: handshake de verificação (hub.mode=subscribe + hub.verify_token)
// - POST: eventos `messages` (entrada do cliente) e `statuses` (sent/delivered/read)
//
// Payload Meta v17+:
// {
//   entry: [{
//     id: "<WABA_ID>",
//     changes: [{
//       value: {
//         metadata: { phone_number_id: "<PNID>" },
//         contacts: [{ wa_id }],
//         messages: [{ id, from, timestamp, type, text: { body }, ... }],
//         statuses: [{ id, status, timestamp, recipient_id, ... }]
//       },
//       field: "messages"
//     }]
//   }]
// }
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cloudinary } from '@/lib/cloudinary'
import { MessageStatus } from '@prisma/client'

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'mult_sorriso_verify'
const META_TOKEN = process.env.META_ACCESS_TOKEN
const GRAPH_URL = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

interface MetaContact {
  wa_id?: string
  profile?: { name?: string }
}
interface MetaMessage {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  image?: { caption?: string }
  button?: { text?: string }
  audio?: { id?: string; mime_type?: string; voice?: boolean }
}
interface MetaStatusError {
  code?: number
  title?: string
  message?: string
  error_data?: { details?: string }
  href?: string
}
interface MetaStatus {
  id?: string            // wamid da mensagem enviada
  status?: string        // sent | delivered | read | failed
  timestamp?: string
  recipient_id?: string
  errors?: MetaStatusError[]   // presente quando status=failed
}
interface MetaChangeValue {
  metadata?: { phone_number_id?: string; display_phone_number?: string }
  contacts?: MetaContact[]
  messages?: MetaMessage[]
  statuses?: MetaStatus[]
}
interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{ value?: MetaChangeValue; field?: string }>
  }>
}

// Baixa um áudio da Meta Cloud API (media_id → URL temporária → binário),
// hospeda no Cloudinary (com versão .mp3 p/ compatibilidade Safari/iOS) e
// devolve a URL permanente. Best-effort: qualquer falha retorna null e a
// conversa segue mostrando "[Áudio]" como texto.
async function fetchAndStoreMetaAudio(
  mediaId: string
): Promise<{ mediaUrl: string; mediaMimeType: string } | null> {
  try {
    if (!META_TOKEN) {
      console.warn('[Meta Audio] META_ACCESS_TOKEN não configurado')
      return null
    }

    // 1. media_id → URL temporária + mime
    const lookup = await fetch(`${GRAPH_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${META_TOKEN}` },
    })
    if (!lookup.ok) {
      console.warn(`[Meta Audio] lookup falhou (${lookup.status}) para ${mediaId}`)
      return null
    }
    const meta = (await lookup.json()) as { url?: string; mime_type?: string }
    if (!meta.url) return null

    // 2. baixa o binário (mesma autenticação Bearer)
    const bin = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${META_TOKEN}` },
    })
    if (!bin.ok) {
      console.warn(`[Meta Audio] download falhou (${bin.status}) para ${mediaId}`)
      return null
    }
    const buffer = Buffer.from(await bin.arrayBuffer())
    const sourceMime = (meta.mime_type || 'audio/ogg').split(';')[0].trim()

    // 3. hospeda no Cloudinary, gerando uma versão .mp3
    const upload = await cloudinary.uploader.upload(
      `data:${sourceMime};base64,${buffer.toString('base64')}`,
      {
        resource_type: 'video',
        folder: 'whatsapp-audios',
        public_id: mediaId,
        overwrite: false,
        eager: [{ format: 'mp3' }],
      }
    )

    const mp3Url = upload.eager?.[0]?.secure_url
    return {
      mediaUrl: mp3Url || upload.secure_url,
      mediaMimeType: mp3Url ? 'audio/mpeg' : sourceMime,
    }
  } catch (err) {
    console.warn(
      '[Meta Audio] Falha ao baixar/hospedar áudio:',
      err instanceof Error ? err.message : err
    )
    return null
  }
}

// Telefones BR podem ter ou não o 9º dígito (após 55 + DDD).
function digitVariants(digits: string): string[] {
  const set = new Set<string>([digits])
  if (digits.length === 12) {
    set.add(digits.slice(0, 4) + '9' + digits.slice(4))
  }
  if (digits.length === 13 && digits[4] === '9') {
    set.add(digits.slice(0, 4) + digits.slice(5))
  }
  return [...set]
}

// Ranking p/ não rebaixar status (ex.: 'delivered' chegando depois de 'read').
const STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  QUEUED: 1,
  SENDING: 2,
  SENT: 3,
  DELIVERED: 4,
  READ: 5,
  FAILED: 3,
}

// Aplica um callback de status da Meta na Message correspondente. Casa
// primeiro pelo wamid (preciso); se não achar — a resposta de envio da
// Evolution é instável e nem sempre salva o wamid — cai num plano B que casa
// pelo telefone do destinatário. É o que mantém o contador "Entregues" correto.
async function applyMetaStatus(
  wamid: string,
  metaStatus: string,
  ts?: string,
  recipientId?: string,
  errors?: MetaStatusError[]
): Promise<void> {
  const map: Record<string, MessageStatus> = {
    sent: MessageStatus.SENT,
    delivered: MessageStatus.DELIVERED,
    read: MessageStatus.READ,
    failed: MessageStatus.FAILED,
  }
  const newStatus = map[metaStatus]
  if (!newStatus) return

  // 1) Casamento preciso pelo wamid
  let message = await prisma.message.findFirst({
    where: { providerMessageId: wamid },
    select: { id: true, status: true },
  })

  // 2) Plano B: casa pelo telefone do destinatário — pega a mensagem mais
  //    recente daquele contato ainda não finalizada.
  if (!message && recipientId) {
    const phones = digitVariants(recipientId.replace(/\D/g, '')).flatMap((d) => [
      d,
      '+' + d,
    ])
    message = await prisma.message.findFirst({
      where: {
        contact: { phone: { in: phones } },
        status: { in: ['PENDING', 'SENDING', 'SENT', 'DELIVERED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    })
  }

  if (!message) return

  // 'failed' não sobrescreve algo já entregue/lido; os demais nunca rebaixam.
  if (newStatus === MessageStatus.FAILED) {
    if (
      message.status === MessageStatus.DELIVERED ||
      message.status === MessageStatus.READ
    ) {
      return
    }
  } else if (
    (STATUS_RANK[newStatus] ?? 0) <= (STATUS_RANK[message.status] ?? 0)
  ) {
    return
  }

  const when = ts ? new Date(parseInt(ts) * 1000) : new Date()

  // Quando a Meta marca failed, ela passa um array `errors` com code/title/details.
  // Serializamos pra Message.errorMsg pra dar contexto ao diagnóstico (Undeliverable,
  // Rate Limit Pair, Re-engagement etc). Sem isso o painel mostra FAILED sem motivo.
  let errorMsg: string | undefined
  if (newStatus === MessageStatus.FAILED && errors && errors.length > 0) {
    const e = errors[0]
    const parts = [
      e.code ? `#${e.code}` : null,
      e.title || e.message,
      e.error_data?.details,
    ].filter((p): p is string => Boolean(p))
    errorMsg = parts.join(' — ') || JSON.stringify(e)
  }

  await prisma.message.update({
    where: { id: message.id },
    data: {
      status: newStatus,
      ...(newStatus === MessageStatus.DELIVERED ? { deliveredAt: when } : {}),
      ...(newStatus === MessageStatus.READ ? { readAt: when } : {}),
      ...(errorMsg ? { errorMsg } : {}),
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MetaWebhookBody

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value
        if (!value) continue

        // TODO: quando houver +1 WABA, casar instance por phone_number_id (precisaria coluna nova).
        // Por ora, atende apenas a única CLOUD_API ativa.
        const instance = await prisma.whatsAppInstance.findFirst({
          where: { provider: 'CLOUD_API', isActive: true },
          select: { id: true },
        })

        // Mensagens recebidas do cliente
        for (const msg of value.messages || []) {
          if (!msg.id || !msg.from || !msg.timestamp) continue
          if (!instance) continue

          const messageText =
            msg.text?.body ||
            msg.image?.caption ||
            msg.button?.text ||
            (msg.type === 'audio' ? '[Áudio]' : `[${msg.type || 'unknown'}]`)

          // Áudio: baixa via Graph API e hospeda no Cloudinary p/ tocar no painel
          let mediaUrl: string | null = null
          let mediaMimeType: string | null = null
          if (msg.type === 'audio' && msg.audio?.id) {
            const audio = await fetchAndStoreMetaAudio(msg.audio.id)
            if (audio) {
              mediaUrl = audio.mediaUrl
              mediaMimeType = audio.mediaMimeType
            }
          }

          // Nome do perfil do WhatsApp de quem enviou
          const pushName =
            value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name ||
            value.contacts?.[0]?.profile?.name ||
            null

          await prisma.conversationMessage.upsert({
            where: { messageId: msg.id },
            create: {
              instanceId: instance.id,
              messageId: msg.id,
              remoteJid: `${msg.from}@s.whatsapp.net`,
              fromMe: false,
              pushName,
              messageText,
              messageType: msg.type || 'text',
              mediaUrl,
              mediaMimeType,
              timestamp: new Date(parseInt(msg.timestamp) * 1000),
            },
            update: {},
          })

          await prisma.conversationResponse.upsert({
            where: { remoteJid: `${msg.from}@s.whatsapp.net` },
            create: {
              remoteJid: `${msg.from}@s.whatsapp.net`,
              needsResponse: true,
              lastMessageAt: new Date(parseInt(msg.timestamp) * 1000),
            },
            update: {
              needsResponse: true,
              lastMessageAt: new Date(parseInt(msg.timestamp) * 1000),
            },
          })
        }

        // Callbacks de status de mensagens enviadas (sent/delivered/read/failed)
        for (const st of value.statuses || []) {
          if (!st.id || !st.status) continue
          await applyMetaStatus(
            st.id,
            st.status,
            st.timestamp,
            st.recipient_id,
            st.errors
          )
        }

      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Meta Webhook] Erro:', error)
    // Retornar 200 mesmo em erro pra Meta não fazer retry agressivo
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
