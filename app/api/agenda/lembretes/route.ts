// app/api/agenda/lembretes/route.ts
// Dispara manualmente a rotina de lembretes (mesma lógica do cron das 8h).
// Útil para testar sem esperar o horário. Restrito a ADMIN.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { runDailyReminders } from '@/lib/reminders'

export async function POST() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
  }

  try {
    const result = await runDailyReminders()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Erro ao disparar lembretes:', error)
    return NextResponse.json({ error: 'Erro ao disparar lembretes' }, { status: 500 })
  }
}
