// app/api/admin/monitoramento/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const since = new Date()
    since.setDate(since.getDate() - days)

    // 1. Todos os usuários
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true }
    })

    // 2. Respostas no período
    const responses = await prisma.conversationResponse.findMany({
      where: {
        respondedAt: { gte: since }
      },
      select: {
        id: true,
        remoteJid: true,
        lastMessageAt: true,
        respondedAt: true,
        respondedByUserId: true
      }
    })

    // 3. Conversas aguardando resposta
    const waiting = await prisma.conversationResponse.findMany({
      where: { needsResponse: true },
      select: {
        remoteJid: true,
        lastMessageAt: true
      }
    })

    // 4. Métricas por usuário
    const userMetrics = users.map(u => {
      const userResponses = responses.filter(r => r.respondedByUserId === u.id)

      const responseTimes = userResponses
        .filter(r => r.respondedAt && r.lastMessageAt)
        .map(r => new Date(r.respondedAt!).getTime() - new Date(r.lastMessageAt).getTime())
        .filter(t => t > 0)

      const avgResponseTimeMs = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0

      const fastestMs = responseTimes.length > 0 ? Math.min(...responseTimes) : 0
      const slowestMs = responseTimes.length > 0 ? Math.max(...responseTimes) : 0

      const distribution = {
        under5min: responseTimes.filter(t => t < 5 * 60 * 1000).length,
        under15min: responseTimes.filter(t => t >= 5 * 60 * 1000 && t < 15 * 60 * 1000).length,
        under30min: responseTimes.filter(t => t >= 15 * 60 * 1000 && t < 30 * 60 * 1000).length,
        under1h: responseTimes.filter(t => t >= 30 * 60 * 1000 && t < 60 * 60 * 1000).length,
        over1h: responseTimes.filter(t => t >= 60 * 60 * 1000).length,
      }

      return {
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        userRole: u.role,
        totalResponded: userResponses.length,
        avgResponseTimeMs,
        fastestMs,
        slowestMs,
        distribution
      }
    })

    // 5. Respostas externas (via WhatsApp, sem userId)
    const externalResponses = responses.filter(r => r.respondedByUserId === null).length

    // 6. Log recente (últimas 50)
    const recentLog = await prisma.conversationResponse.findMany({
      where: {
        respondedAt: { not: null }
      },
      include: {
        respondedBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { respondedAt: 'desc' },
      take: 50
    })

    const enrichedLog = await Promise.all(
      recentLog.map(async (entry) => {
        const lastMsg = await prisma.conversationMessage.findFirst({
          where: { remoteJid: entry.remoteJid },
          orderBy: { timestamp: 'desc' },
          select: { pushName: true }
        })

        const displayPhone = entry.remoteJid
          .replace('@s.whatsapp.net', '')
          .replace('@g.us', '')

        return {
          id: entry.id,
          remoteJid: entry.remoteJid,
          displayName: lastMsg?.pushName || displayPhone,
          displayPhone,
          lastMessageAt: entry.lastMessageAt,
          respondedAt: entry.respondedAt,
          responseTimeMs: entry.respondedAt
            ? new Date(entry.respondedAt).getTime() - new Date(entry.lastMessageAt).getTime()
            : null,
          respondedBy: entry.respondedBy?.name || 'WhatsApp (externo)'
        }
      })
    )

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      summary: {
        totalResponded: responses.length,
        totalWaiting: waiting.length,
        externalResponses,
        avgWaitingTimeMs: waiting.length > 0
          ? waiting.reduce((sum, w) => sum + (Date.now() - new Date(w.lastMessageAt).getTime()), 0) / waiting.length
          : 0
      },
      userMetrics,
      recentLog: enrichedLog
    })
  } catch (error) {
    console.error('[Monitoramento] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados de monitoramento' },
      { status: 500 }
    )
  }
}
