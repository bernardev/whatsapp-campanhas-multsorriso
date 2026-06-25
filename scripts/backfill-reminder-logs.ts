// scripts/backfill-reminder-logs.ts
// Migração de dados ONE-TIME: cria ReminderLog a partir dos carimbos
// lembreteVesperaEnviadoEm / lembreteDiaEnviadoEm que já existiam nos
// agendamentos antes da tabela de log existir. Idempotente.
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { TEMPLATE_VESPERA, TEMPLATE_DIA } from '../lib/agenda'

async function main() {
  const apts = await prisma.appointment.findMany({
    where: {
      OR: [
        { lembreteVesperaEnviadoEm: { not: null } },
        { lembreteDiaEnviadoEm: { not: null } },
      ],
    },
    include: { contact: true, reminderLogs: true },
  })

  let criados = 0
  for (const a of apts) {
    const jaTem = (t: 'VESPERA' | 'DIA') => a.reminderLogs.some((l) => l.type === t)

    if (a.lembreteVesperaEnviadoEm && !jaTem('VESPERA')) {
      await prisma.reminderLog.create({
        data: {
          appointmentId: a.id,
          contactName: a.contact.name,
          contactPhone: a.contact.phone,
          type: 'VESPERA',
          status: 'SENT',
          templateName: TEMPLATE_VESPERA.name,
          scheduledFor: a.scheduledFor,
          createdAt: a.lembreteVesperaEnviadoEm, // horário real do envio
        },
      })
      criados++
    }
    if (a.lembreteDiaEnviadoEm && !jaTem('DIA')) {
      await prisma.reminderLog.create({
        data: {
          appointmentId: a.id,
          contactName: a.contact.name,
          contactPhone: a.contact.phone,
          type: 'DIA',
          status: 'SENT',
          templateName: TEMPLATE_DIA.name,
          scheduledFor: a.scheduledFor,
          createdAt: a.lembreteDiaEnviadoEm,
        },
      })
      criados++
    }
  }
  console.log(`Backfill concluído: ${criados} registro(s) criado(s). Total na tabela:`, await prisma.reminderLog.count())
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERRO:', e.message); process.exit(1) })
