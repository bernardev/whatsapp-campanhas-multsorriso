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

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'mult_sorriso_verify'

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

interface MetaContact { wa_id?: string }
interface MetaMessage {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  image?: { caption?: string }
  button?: { text?: string }
}
interface MetaChangeValue {
  metadata?: { phone_number_id?: string; display_phone_number?: string }
  contacts?: MetaContact[]
  messages?: MetaMessage[]
}
interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{ value?: MetaChangeValue; field?: string }>
  }>
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
            `[${msg.type || 'unknown'}]`

          await prisma.conversationMessage.upsert({
            where: { messageId: msg.id },
            create: {
              instanceId: instance.id,
              messageId: msg.id,
              remoteJid: `${msg.from}@s.whatsapp.net`,
              fromMe: false,
              messageText,
              messageType: msg.type || 'text',
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

      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Meta Webhook] Erro:', error)
    // Retornar 200 mesmo em erro pra Meta não fazer retry agressivo
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
