// lib/reminders.ts
// Lógica dos lembretes automáticos de avaliação (disparada todo dia às 8h).
// - VÉSPERA (consultas de amanhã): template lembrete_24h
// - NO DIA (consultas de hoje):     template confirmacao_consulta
// Cada tentativa (sucesso ou falha) é registrada em ReminderLog para monitoramento.
import type { Appointment, Contact } from '@prisma/client'
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

type ReminderType = 'VESPERA' | 'DIA'

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

// Extrai o wamid da resposta da Evolution (normaliza key.id ou messages[0].id).
function extractWamid(data: unknown): string | undefined {
  const d = (data || {}) as { key?: { id?: string }; messages?: Array<{ id?: string }> }
  return d.key?.id || d.messages?.[0]?.id
}

// Envia UM lembrete e registra o resultado no log. Retorna true se enviou.
async function enviarLembrete(
  apt: Appointment & { contact: Contact },
  type: ReminderType
): Promise<boolean> {
  const isVespera = type === 'VESPERA'
  const tpl = isVespera ? TEMPLATE_VESPERA : TEMPLATE_DIA
  const nome = apt.contact.name || 'paciente'

  const params = isVespera
    ? [nome, formatDataSP(apt.scheduledFor), formatHoraSP(apt.scheduledFor)]
    : [
        nome,
        formatDataSP(apt.scheduledFor),
        formatHoraSP(apt.scheduledFor),
        apt.professional || PROFISSIONAL_PADRAO,
      ]

  const instanceKey = await getCloudInstanceKey(apt.instanceId)

  if (!instanceKey) {
    await prisma.reminderLog.create({
      data: {
        appointmentId: apt.id,
        contactName: apt.contact.name,
        contactPhone: apt.contact.phone,
        type,
        status: 'FAILED',
        templateName: tpl.name,
        error: 'Nenhuma instância CLOUD_API disponível',
        scheduledFor: apt.scheduledFor,
      },
    })
    console.warn(`[Lembretes] Sem instância CLOUD_API — ${type} não enviado para ${apt.contact.phone}`)
    return false
  }

  const r = await sendTemplateMessage(instanceKey, apt.contact.phone, tpl.name, tpl.language, params)

  if (r.success) {
    const wamid = extractWamid(r.data)
    await prisma.$transaction([
      prisma.reminderLog.create({
        data: {
          appointmentId: apt.id,
          contactName: apt.contact.name,
          contactPhone: apt.contact.phone,
          type,
          status: 'SENT',
          templateName: tpl.name,
          providerMessageId: wamid || null,
          scheduledFor: apt.scheduledFor,
        },
      }),
      prisma.appointment.update({
        where: { id: apt.id },
        data: isVespera
          ? { lembreteVesperaEnviadoEm: new Date() }
          : { lembreteDiaEnviadoEm: new Date() },
      }),
    ])
    console.log(`[Lembretes] ✅ ${type} enviado para ${nome} (${apt.contact.phone})`)
    return true
  }

  await prisma.reminderLog.create({
    data: {
      appointmentId: apt.id,
      contactName: apt.contact.name,
      contactPhone: apt.contact.phone,
      type,
      status: 'FAILED',
      templateName: tpl.name,
      error: r.error || 'Erro desconhecido',
      scheduledFor: apt.scheduledFor,
    },
  })
  console.error(`[Lembretes] ❌ ${type} falhou para ${apt.contact.phone}: ${r.error}`)
  return false
}

// VÉSPERA: envia o lembrete para as consultas de AMANHÃ ainda não avisadas.
export async function runVespera(now: Date = new Date()): Promise<{ enviados: number; falhas: number }> {
  const amanha = spDayBoundsUtc(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  const res = { enviados: 0, falhas: 0 }

  const vespera = await prisma.appointment.findMany({
    where: {
      scheduledFor: { gte: amanha.start, lte: amanha.end },
      status: { in: [...STATUS_ATIVOS] },
      lembreteVesperaEnviadoEm: null,
    },
    include: { contact: true },
  })
  for (const apt of vespera) {
    const ok = await enviarLembrete(apt, 'VESPERA')
    if (ok) res.enviados++
    else res.falhas++
  }
  return res
}

// NO DIA: envia a confirmação para as consultas de HOJE ainda não avisadas.
export async function runDia(now: Date = new Date()): Promise<{ enviados: number; falhas: number }> {
  const hoje = spDayBoundsUtc(now)
  const res = { enviados: 0, falhas: 0 }

  const dia = await prisma.appointment.findMany({
    where: {
      scheduledFor: { gte: hoje.start, lte: hoje.end },
      status: { in: [...STATUS_ATIVOS] },
      lembreteDiaEnviadoEm: null,
    },
    include: { contact: true },
  })
  for (const apt of dia) {
    const ok = await enviarLembrete(apt, 'DIA')
    if (ok) res.enviados++
    else res.falhas++
  }
  return res
}

export async function runDailyReminders(now: Date = new Date()): Promise<ReminderResult> {
  const hoje = spDayBoundsUtc(now)
  const amanha = spDayBoundsUtc(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  console.log(`[Lembretes] Rodando — hoje=${hoje.ymd}, amanhã=${amanha.ymd}`)

  const vespera = await runVespera(now)
  const dia = await runDia(now)

  console.log(
    `[Lembretes] Concluído — véspera: ${vespera.enviados} enviados / ${vespera.falhas} falhas; dia: ${dia.enviados} enviados / ${dia.falhas} falhas`
  )
  return { vespera, dia }
}
