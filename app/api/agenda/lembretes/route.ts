// app/api/agenda/lembretes/route.ts
// GET  → histórico de envios de lembrete (monitoramento) — qualquer usuário logado
// POST → dispara manualmente a rotina (mesma lógica do cron das 8h) — apenas ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import { runDailyReminders } from '@/lib/reminders'
import { spDayBoundsUtc } from '@/lib/agenda'

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'seu-secret-super-seguro'
)

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('auth-token')?.value
  if (!token) return false
  try {
    await jwtVerify(token, SECRET)
    return true
  } catch {
    return false
  }
}

// GET - Lista os últimos lembretes enviados (com filtros opcionais)
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // SENT | FAILED
    const date = searchParams.get('date') // YYYY-MM-DD → filtra pela DATA DA CONSULTA (fuso SP)
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500)

    const where: {
      status?: 'SENT' | 'FAILED'
      scheduledFor?: { gte: Date; lte: Date }
    } = {}

    if (status === 'SENT' || status === 'FAILED') where.status = status

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Usa o meio-dia para evitar qualquer ambiguidade de borda do dia
      const { start, end } = spDayBoundsUtc(new Date(`${date}T12:00:00-03:00`))
      where.scheduledFor = { gte: start, lte: end }
    }

    const logs = await prisma.reminderLog.findMany({
      where,
      // Ordena pela consulta (mais recente primeiro) e depois pelo horário do envio
      orderBy: [{ scheduledFor: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    })

    const [totalSent, totalFailed] = await Promise.all([
      prisma.reminderLog.count({ where: { status: 'SENT' } }),
      prisma.reminderLog.count({ where: { status: 'FAILED' } }),
    ])

    return NextResponse.json({ logs, stats: { totalSent, totalFailed } })
  } catch (error) {
    console.error('Erro ao listar lembretes:', error)
    return NextResponse.json({ error: 'Erro ao listar lembretes' }, { status: 500 })
  }
}

// POST - Dispara manualmente a rotina de lembretes (restrito a ADMIN)
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
