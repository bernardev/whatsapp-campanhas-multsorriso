// scripts/sync-conversation-responses.ts
import { prisma } from '../lib/prisma'

async function syncConversationResponses() {
  console.log('[Sync] Iniciando sincronização...')

  // Busca todas as conversas com mensagens recebidas (fromMe: false)
  const conversations = await prisma.conversationMessage.groupBy({
    by: ['remoteJid'],
    where: {
      fromMe: false
    },
    _max: {
      timestamp: true
    }
  })

  console.log(`[Sync] Encontradas ${conversations.length} conversas`)

  let created = 0
  let updated = 0

  for (const conv of conversations) {
    if (!conv.remoteJid || !conv._max.timestamp) continue

    const existing = await prisma.conversationResponse.findUnique({
      where: { remoteJid: conv.remoteJid }
    })

    if (!existing) {
      await prisma.conversationResponse.create({
        data: {
          remoteJid: conv.remoteJid,
          needsResponse: true,
          lastMessageAt: conv._max.timestamp
        }
      })
      created++
      console.log(`[Sync] Criado: ${conv.remoteJid}`)
    } else if (!existing.respondedAt && existing.needsResponse) {
      await prisma.conversationResponse.update({
        where: { remoteJid: conv.remoteJid },
        data: {
          lastMessageAt: conv._max.timestamp
        }
      })
      updated++
    }
  }

  console.log(`[Sync] Concluído: ${created} criados, ${updated} atualizados`)
  process.exit(0)
}

syncConversationResponses().catch(error => {
  console.error('[Sync] Erro:', error)
  process.exit(1)
})