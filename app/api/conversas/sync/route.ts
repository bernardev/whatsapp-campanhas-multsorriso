import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY

// Tipos da Evolution API v2.3.7
interface EvolutionMessageKey {
  id: string
  fromMe: boolean
  remoteJid: string
  participant?: string
}

interface EvolutionMessage {
  conversation?: string
  extendedTextMessage?: { text: string }
  imageMessage?: { caption?: string }
  videoMessage?: { caption?: string }
  audioMessage?: Record<string, unknown>
  stickerMessage?: Record<string, unknown>
  albumMessage?: Record<string, unknown>
  reactionMessage?: { text?: string }
}

interface EvolutionLastMessage {
  id: string
  key: EvolutionMessageKey
  pushName?: string
  messageType: string
  message: EvolutionMessage
  messageTimestamp: number
  instanceId: string
  source?: string
}

interface EvolutionChat {
  id: string
  remoteJid: string
  pushName?: string
  profilePicUrl?: string
  updatedAt?: string
  lastMessage?: EvolutionLastMessage
  unreadCount?: number
  isSaved?: boolean
}

function extractText(msg: EvolutionMessage, messageType: string): string {
  if (msg.conversation) return msg.conversation
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text
  if (msg.imageMessage?.caption) return msg.imageMessage.caption
  if (msg.videoMessage?.caption) return msg.videoMessage.caption
  if (msg.reactionMessage?.text) return `Reação: ${msg.reactionMessage.text}`
  if (messageType === 'audioMessage') return '[Áudio]'
  if (messageType === 'stickerMessage') return '[Sticker]'
  if (messageType === 'imageMessage') return '[Imagem]'
  if (messageType === 'videoMessage') return '[Vídeo]'
  if (messageType === 'albumMessage') return '[Álbum]'
  return '[Mídia]'
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const instances = await prisma.whatsAppInstance.findMany({
      where: { isActive: true, status: { not: 'deleted' } }
    })

    if (instances.length === 0) {
      return NextResponse.json({ error: 'Nenhuma instância conectada' }, { status: 400 })
    }

    const headers: HeadersInit = {
      'apikey': EVOLUTION_KEY!,
      'Content-Type': 'application/json'
    }

    let totalChats = 0
    let totalSynced = 0
    let totalSkipped = 0

    for (const instance of instances) {
      try {
        console.log(`[Sync] Sincronizando instância: ${instance.name} (${instance.instanceKey})`)

        const chatsRes = await fetch(
          `${EVOLUTION_URL}/chat/findChats/${instance.instanceKey}`,
          { method: 'POST', headers, body: JSON.stringify({}) }
        )

        if (!chatsRes.ok) {
          const err = await chatsRes.text()
          console.error(`[Sync] Erro ao buscar chats da instância ${instance.name}:`, err)
          continue // Pula para a próxima instância
        }

        const chats: EvolutionChat[] = await chatsRes.json()

        for (const chat of chats) {
          const remoteJid = chat.remoteJid

          if (!remoteJid || remoteJid === 'status@broadcast') continue

          const lastMsg = chat.lastMessage
          if (!lastMsg) {
            totalSkipped++
            continue
          }

          totalChats++

          const messageId = lastMsg.key?.id
          if (!messageId) continue

          const text = extractText(lastMsg.message, lastMsg.messageType)
          const fromMe = lastMsg.key?.fromMe ?? false
          const timestamp = lastMsg.messageTimestamp
            ? new Date(Number(lastMsg.messageTimestamp) * 1000)
            : new Date()

          const pushName = lastMsg.pushName || chat.pushName || null

          try {
            await prisma.conversationMessage.upsert({
              where: { messageId },
              create: {
                messageId,
                instanceId: instance.id,
                remoteJid,
                fromMe,
                participant: lastMsg.key?.participant ?? null,
                pushName,
                messageText: text,
                messageType: lastMsg.messageType ?? 'conversation',
                imageUrl: null,
                timestamp,
              },
              update: {
                messageText: text,
                pushName,
              }
            })

            await prisma.conversationResponse.upsert({
              where: { remoteJid },
              create: {
                remoteJid,
                needsResponse: !fromMe,
                lastMessageAt: timestamp,
              },
              update: {
                lastMessageAt: timestamp,
              }
            })

            totalSynced++
          } catch (err) {
            console.error(`[Sync] Erro no chat ${remoteJid}:`, err)
          }
        }

        console.log(`[Sync] Instância ${instance.name} sincronizada`)
      } catch (err) {
        console.error(`[Sync] Erro na instância ${instance.name}:`, err)
        continue
      }
    }

    console.log(`[Sync] Concluído: ${instances.length} instância(s), ${totalChats} chats, ${totalSynced} sincronizados, ${totalSkipped} sem lastMessage`)

    return NextResponse.json({
      success: true,
      totalInstances: instances.length,
      totalChats,
      totalSynced,
      totalSkipped,
      message: `${totalSynced} conversas sincronizadas de ${instances.length} instância(s)`
    })

  } catch (error) {
    console.error('[Sync] Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno no sync' }, { status: 500 })
  }
}