// lib/campaign-status.ts
import { prisma } from './prisma'

// Marca a campanha como COMPLETED quando não resta nenhuma mensagem por
// processar.
//
// Antes isso só acontecia no webhook do Evolution (Baileys). Como as campanhas
// hoje saem por Cloud API/Meta — cujo webhook não mexe em campanha — elas
// ficavam presas em RUNNING para sempre. Fazendo no worker, vale para os dois
// provedores e não depende de webhook.
export async function finalizeCampaignIfDone(
  campaignId: string | undefined
): Promise<void> {
  if (!campaignId) return
  try {
    const pendentes = await prisma.message.count({
      where: { campaignId, status: { in: ['PENDING', 'SENDING'] } },
    })
    if (pendentes > 0) return

    const total = await prisma.message.count({ where: { campaignId } })
    if (total === 0) return

    // updateMany com status no where: idempotente e evita corrida entre jobs.
    const r = await prisma.campaign.updateMany({
      where: { id: campaignId, status: 'RUNNING' },
      data: { status: 'COMPLETED' },
    })
    if (r.count > 0) {
      console.log(`[Campanha] ${campaignId} concluída (${total} mensagens)`)
    }
  } catch (error) {
    console.error(
      '[Campanha] Erro ao finalizar:',
      error instanceof Error ? error.message : error
    )
  }
}
