// lib/reminders.ts
// Lógica dos lembretes automáticos de avaliação (disparada todo dia às 8h).
// - VÉSPERA (consultas de amanhã): template lembrete_24h
// - NO DIA (consultas de hoje):     template confirmacao_consulta
import { prisma } from './prisma'
import { sendTemplateMessage } from './evolution'
import {
  spDayBoundsUtc,
  formatDataSP,
  formatHoraSP,
  TEMPLATE_VESPERA,
  TEMPLATE_DIA,
  PROFISSIONAL_PADRAO,
} from './agenda'

// Só lembramos quem ainda está com a consulta de pé.
const STATUS_ATIVOS = ['AGENDADO', 'CONFIRMADO'] as const

interface ReminderResult {
  vespera: { enviados: number; falhas: number }
  dia: { enviados: number; falhas: number }
}

// Resolve a instância CLOUD_API que envia os lembretes.
async function getCloudInstanceKey(fallbackId?: string | null): Promise<string | null> {
  if (fallbackId) {
    const inst = await prisma.whatsAppInstance.findUnique({ where: { id: fallbackId } })
    if (inst) return inst.instanceKey
  }
  const inst = await prisma.whatsAppInstance.findFirst({
    where: { provider: 'CLOUD_API' },
    orderBy: { status: 'asc' },
  })
  return inst?.instanceKey || null
}

export async function runDailyReminders(now: Date = new Date()): Promise<ReminderResult> {
  const hoje = spDayBoundsUtc(now)
  const amanha = spDayBoundsUtc(new Date(now.getTime() + 24 * 60 * 60 * 1000))

  console.log(
    `[Lembretes] Rodando — hoje=${hoje.ymd}, amanhã=${amanha.ymd}`
  )

  const result: ReminderResult = {
    vespera: { enviados: 0, falhas: 0 },
    dia: { enviados: 0, falhas: 0 },
  }

  // ===== VÉSPERA: consultas de AMANHÃ que ainda não receberam o lembrete =====
  const vespera = await prisma.appointment.findMany({
    where: {
      scheduledFor: { gte: amanha.start, lte: amanha.end },
      status: { in: [...STATUS_ATIVOS] },
      lembreteVesperaEnviadoEm: null,
    },
    include: { contact: true },
  })

  for (const apt of vespera) {
    const instanceKey = await getCloudInstanceKey(apt.instanceId)
    if (!instanceKey) {
      console.warn('[Lembretes] Nenhuma instância CLOUD_API disponível — pulando véspera')
      result.vespera.falhas++
      continue
    }
    const nome = apt.contact.name || 'paciente'
    const params = [nome, formatDataSP(apt.scheduledFor), formatHoraSP(apt.scheduledFor)]
    const r = await sendTemplateMessage(
      instanceKey,
      apt.contact.phone,
      TEMPLATE_VESPERA.name,
      TEMPLATE_VESPERA.language,
      params
    )
    if (r.success) {
      await prisma.appointment.update({
        where: { id: apt.id },
        data: { lembreteVesperaEnviadoEm: new Date() },
      })
      result.vespera.enviados++
      console.log(`[Lembretes] ✅ Véspera enviado para ${nome} (${apt.contact.phone})`)
    } else {
      result.vespera.falhas++
      console.error(`[Lembretes] ❌ Véspera falhou para ${apt.contact.phone}: ${r.error}`)
    }
  }

  // ===== NO DIA: consultas de HOJE que ainda não receberam o lembrete =====
  const dia = await prisma.appointment.findMany({
    where: {
      scheduledFor: { gte: hoje.start, lte: hoje.end },
      status: { in: [...STATUS_ATIVOS] },
      lembreteDiaEnviadoEm: null,
    },
    include: { contact: true },
  })

  for (const apt of dia) {
    const instanceKey = await getCloudInstanceKey(apt.instanceId)
    if (!instanceKey) {
      console.warn('[Lembretes] Nenhuma instância CLOUD_API disponível — pulando dia')
      result.dia.falhas++
      continue
    }
    const nome = apt.contact.name || 'paciente'
    const params = [
      nome,
      formatDataSP(apt.scheduledFor),
      formatHoraSP(apt.scheduledFor),
      apt.professional || PROFISSIONAL_PADRAO,
    ]
    const r = await sendTemplateMessage(
      instanceKey,
      apt.contact.phone,
      TEMPLATE_DIA.name,
      TEMPLATE_DIA.language,
      params
    )
    if (r.success) {
      await prisma.appointment.update({
        where: { id: apt.id },
        data: { lembreteDiaEnviadoEm: new Date() },
      })
      result.dia.enviados++
      console.log(`[Lembretes] ✅ Dia enviado para ${nome} (${apt.contact.phone})`)
    } else {
      result.dia.falhas++
      console.error(`[Lembretes] ❌ Dia falhou para ${apt.contact.phone}: ${r.error}`)
    }
  }

  console.log(
    `[Lembretes] Concluído — véspera: ${result.vespera.enviados} enviados / ${result.vespera.falhas} falhas; dia: ${result.dia.enviados} enviados / ${result.dia.falhas} falhas`
  )
  return result
}
