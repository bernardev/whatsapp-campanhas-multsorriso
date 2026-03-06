// app/(dashboard)/monitoramento/monitoramento-client.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import Image from 'next/image'
import {
  BarChart3,
  Users,
  MessageSquare,
  Smartphone,
  Bell,
  Check,
  Clock,
  Activity,
  Timer,
  AlertTriangle,
  ExternalLink,
  User,
  TrendingUp,
  Loader2,
  UserCog
} from 'lucide-react'

interface Distribution {
  under5min: number
  under15min: number
  under30min: number
  under1h: number
  over1h: number
}

interface UserMetric {
  userId: string
  userName: string
  userEmail: string
  userRole: string
  totalResponded: number
  avgResponseTimeMs: number
  fastestMs: number
  slowestMs: number
  distribution: Distribution
}

interface LogEntry {
  id: string
  remoteJid: string
  displayName: string
  displayPhone: string
  lastMessageAt: string
  respondedAt: string | null
  responseTimeMs: number | null
  respondedBy: string
}

interface MonitoramentoData {
  period: { days: number; since: string }
  summary: {
    totalResponded: number
    totalWaiting: number
    externalResponses: number
    avgWaitingTimeMs: number
  }
  userMetrics: UserMetric[]
  recentLog: LogEntry[]
}

interface Notificacao {
  id: string
  type: 'nova_resposta' | 'aguardando_10min' | 'aguardando_30min' | 'aguardando_1h'
  clientName: string
  phone: string
  remoteJid: string
  lastMessage: string
  waitingMinutes: number
  timestamp: Date
}

interface MonitoramentoClientProps {
  user: {
    id: string
    name: string
    email: string
    role: 'ADMIN' | 'USER'
  }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '-'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}min`
  const hours = Math.floor(ms / 3600000)
  const mins = Math.round((ms % 3600000) / 60000)
  return `${hours}h ${mins}min`
}

function getResponseTimeColor(ms: number | null): string {
  if (ms === null) return 'text-slate-400'
  if (ms < 5 * 60 * 1000) return 'text-emerald-600'
  if (ms < 15 * 60 * 1000) return 'text-yellow-600'
  if (ms < 30 * 60 * 1000) return 'text-orange-600'
  return 'text-red-600'
}

function getResponseTimeBg(ms: number | null): string {
  if (ms === null) return 'bg-slate-100'
  if (ms < 5 * 60 * 1000) return 'bg-emerald-50'
  if (ms < 15 * 60 * 1000) return 'bg-yellow-50'
  if (ms < 30 * 60 * 1000) return 'bg-orange-50'
  return 'bg-red-50'
}

export default function MonitoramentoClient({ user }: MonitoramentoClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<MonitoramentoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDays, setSelectedDays] = useState(30)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    loadData()
  }, [selectedDays])

  useEffect(() => {
    loadNotificacoes()
    const interval = setInterval(loadNotificacoes, 2000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/monitoramento?days=${selectedDays}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (error) {
      console.error('Erro ao carregar monitoramento:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadNotificacoes() {
    try {
      const response = await fetch('/api/notificacoes')
      const data = await response.json()
      setNotificacoes(data.notificacoes || [])
    } catch (error) {
      console.error('Erro ao carregar notificações:', error)
    }
  }

  async function handleLogout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const isActive = (path: string): boolean => pathname.startsWith(path)

  const formatRelativeTime = (date: Date | string): string => {
    const now = new Date()
    const then = new Date(date)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins}min atrás`
    if (diffHours < 24) return `${diffHours}h atrás`

    return then.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header com Navegação */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Image
                src="/logo-multsorriso.png"
                alt="MultSorriso"
                width={140}
                height={56}
                className="object-contain cursor-pointer"
                onClick={() => router.push('/campanhas')}
              />

              <nav className="hidden md:flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => router.push('/campanhas')}
                  className={`flex items-center gap-2 ${
                    isActive('/campanhas') && !isActive('/conversas') && !isActive('/monitoramento')
                      ? 'bg-[#BD8F29]/10 text-[#BD8F29] font-semibold'
                      : 'text-slate-600 hover:text-[#1D2748]'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => router.push('/contatos')}
                  className={`flex items-center gap-2 ${
                    isActive('/contatos')
                      ? 'bg-[#BD8F29]/10 text-[#BD8F29] font-semibold'
                      : 'text-slate-600 hover:text-[#1D2748]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Contatos
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => router.push('/conversas')}
                  className={`flex items-center gap-2 ${
                    isActive('/conversas')
                      ? 'bg-[#BD8F29]/10 text-[#BD8F29] font-semibold'
                      : 'text-slate-600 hover:text-[#1D2748]'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Conversas
                </Button>

                {user.role === 'ADMIN' && (
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/leads')}
                    className={`flex items-center gap-2 ${
                      isActive('/leads')
                        ? 'bg-[#BD8F29]/10 text-[#BD8F29] font-semibold'
                        : 'text-slate-600 hover:text-[#1D2748]'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Leads
                  </Button>
                )}

                {user.role === 'ADMIN' && (
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/instancias')}
                    className={`flex items-center gap-2 ${
                      isActive('/instancias')
                        ? 'bg-[#BD8F29]/10 text-[#BD8F29] font-semibold'
                        : 'text-slate-600 hover:text-[#1D2748]'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    Instâncias
                  </Button>
                )}

                {user.role === 'ADMIN' && (
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/monitoramento')}
                    className={`flex items-center gap-2 ${
                      isActive('/monitoramento')
                        ? 'bg-[#BD8F29]/10 text-[#BD8F29] font-semibold'
                        : 'text-slate-600 hover:text-[#1D2748]'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    Monitoramento
                  </Button>
                )}

                {user.role === 'ADMIN' && (
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/usuarios')}
                    className={`flex items-center gap-2 ${
                      isActive('/usuarios')
                        ? 'bg-[#BD8F29]/10 text-[#BD8F29] font-semibold'
                        : 'text-slate-600 hover:text-[#1D2748]'
                    }`}
                  >
                    <UserCog className="w-4 h-4" />
                    Usuários
                  </Button>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {/* Notificações */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative text-slate-600 hover:text-[#1D2748]"
                >
                  <Bell className="w-5 h-5" />
                  {notificacoes.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                      {notificacoes.length}
                    </span>
                  )}
                </Button>

                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-[#BD8F29]/5 to-white">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-[#1D2748] flex items-center gap-2">
                            <Bell className="w-5 h-5 text-[#BD8F29]" />
                            Notificações
                          </h3>
                          <span className="text-xs text-slate-500 font-medium">
                            {notificacoes.length} {notificacoes.length === 1 ? 'pendente' : 'pendentes'}
                          </span>
                        </div>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {notificacoes.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm text-slate-500">Nenhuma notificação</p>
                          </div>
                        ) : (
                          notificacoes.map((notif) => (
                            <button
                              key={notif.id}
                              onClick={() => {
                                setShowNotifications(false)
                                router.push(`/conversas?remoteJid=${encodeURIComponent(notif.remoteJid)}`)
                              }}
                              className="w-full p-3 hover:bg-slate-50 text-left border-b border-slate-100"
                            >
                              <p className="font-semibold text-sm text-[#1D2748]">{notif.clientName}</p>
                              <p className="text-xs text-slate-500 truncate">{notif.lastMessage}</p>
                              <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(notif.timestamp)}</p>
                            </button>
                          ))
                        )}
                      </div>
                      {notificacoes.length > 0 && (
                        <div className="p-3 border-t border-slate-200 bg-slate-50">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const remoteJids = notificacoes.map(n => n.remoteJid)
                              await fetch('/api/notificacoes/marcar-lidas', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ remoteJids })
                              })
                              await loadNotificacoes()
                              setShowNotifications(false)
                            }}
                            className="w-full border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white font-semibold"
                          >
                            <Check className="w-4 h-4 mr-1.5" />
                            Marcar todas como lidas
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-[#1D2748]">{user.name}</span>
                <span className="text-xs text-slate-500">{user.email}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 hover:bg-slate-50 text-slate-700"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#1D2748]/5 to-[#BD8F29]/5 rounded-3xl blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-8 h-8 text-[#BD8F29]" />
                <h1 className="text-4xl font-bold text-[#1D2748]">Monitoramento</h1>
              </div>
              <p className="text-slate-600 text-lg">
                Acompanhe o desempenho da equipe no atendimento
              </p>
            </div>

            {/* Filtro de Período */}
            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
              {[7, 15, 30].map((d) => (
                <Button
                  key={d}
                  variant={selectedDays === d ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedDays(d)}
                  className={selectedDays === d
                    ? 'bg-[#BD8F29] text-white hover:bg-[#BD8F29]/90'
                    : 'text-slate-600 hover:text-[#1D2748]'
                  }
                >
                  {d}d
                </Button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#BD8F29]" />
            <span className="ml-3 text-slate-600">Carregando dados...</span>
          </div>
        ) : data ? (
          <>
            {/* Cards Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {/* Total Respondidas */}
              <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50/30 overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <CardHeader className="pb-3">
                  <CardDescription className="text-slate-600 font-medium">Total Respondidas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-4xl font-bold text-[#1D2748] mb-1">{data.summary.totalResponded}</div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <TrendingUp className="w-3 h-3" />
                        <span>Últimos {selectedDays} dias</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tempo Médio */}
              <Card className="border-0 shadow-lg shadow-emerald-200/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-emerald-50/30 overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <CardHeader className="pb-3">
                  <CardDescription className="text-slate-600 font-medium">Tempo Médio de Resposta</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-4xl font-bold text-emerald-600 mb-1">
                        {data.userMetrics.length > 0
                          ? formatDuration(
                              data.userMetrics.reduce((sum, u) => sum + u.avgResponseTimeMs, 0) /
                              data.userMetrics.filter(u => u.avgResponseTimeMs > 0).length || 0
                            )
                          : '-'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-emerald-600">
                        <Timer className="w-3 h-3" />
                        <span className="font-medium">Geral da equipe</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Aguardando */}
              <Card className={`border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group ${
                data.summary.totalWaiting > 0
                  ? 'shadow-red-200/50 bg-gradient-to-br from-white to-red-50/30'
                  : 'shadow-slate-200/50 bg-gradient-to-br from-white to-slate-50/30'
              }`}>
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 ${
                  data.summary.totalWaiting > 0 ? 'bg-gradient-to-br from-red-500/10 to-transparent' : 'bg-gradient-to-br from-slate-500/10 to-transparent'
                }`} />
                <CardHeader className="pb-3">
                  <CardDescription className="text-slate-600 font-medium">Aguardando Resposta</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className={`text-4xl font-bold mb-1 ${data.summary.totalWaiting > 0 ? 'text-red-600' : 'text-[#1D2748]'}`}>
                        {data.summary.totalWaiting}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        {data.summary.totalWaiting > 0 ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-red-500" />
                            <span>Média: {formatDuration(data.summary.avgWaitingTimeMs)}</span>
                          </>
                        ) : (
                          <span>Todas respondidas</span>
                        )}
                      </div>
                    </div>
                    <div className={`p-3 rounded-2xl shadow-lg ${
                      data.summary.totalWaiting > 0
                        ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/20'
                        : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-500/20'
                    }`}>
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Externas */}
              <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-purple-50/30 overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <CardHeader className="pb-3">
                  <CardDescription className="text-slate-600 font-medium">Via WhatsApp Externo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-4xl font-bold text-[#1D2748] mb-1">{data.summary.externalResponses}</div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <ExternalLink className="w-3 h-3" />
                        <span>Fora da plataforma</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20">
                      <Smartphone className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Desempenho por Usuário */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-[#1D2748] mb-1">Desempenho por Usuário</h2>
              <p className="text-slate-500 text-sm mb-6">Métricas individuais de atendimento</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.userMetrics
                  .filter(u => u.totalResponded > 0 || u.userRole === 'USER')
                  .map((metric) => {
                    const totalDist = metric.distribution.under5min + metric.distribution.under15min +
                      metric.distribution.under30min + metric.distribution.under1h + metric.distribution.over1h

                    return (
                      <Card key={metric.userId} className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#BD8F29] to-[#BD8F29]/80 flex items-center justify-center text-white font-bold">
                              {metric.userName[0]?.toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-[#1D2748]">{metric.userName}</h3>
                              <p className="text-xs text-slate-500">{metric.userEmail}</p>
                            </div>
                            <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              metric.userRole === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {metric.userRole}
                            </span>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center p-3 rounded-xl bg-slate-50">
                              <div className="text-2xl font-bold text-[#1D2748]">{metric.totalResponded}</div>
                              <div className="text-xs text-slate-500">Respondidas</div>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-slate-50">
                              <div className={`text-2xl font-bold ${getResponseTimeColor(metric.avgResponseTimeMs)}`}>
                                {formatDuration(metric.avgResponseTimeMs)}
                              </div>
                              <div className="text-xs text-slate-500">Tempo Médio</div>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-slate-50">
                              <div className="text-2xl font-bold text-[#1D2748]">
                                {formatDuration(metric.fastestMs)}
                              </div>
                              <div className="text-xs text-slate-500">Mais Rápido</div>
                            </div>
                          </div>

                          {/* Barra de Distribuição */}
                          {totalDist > 0 && (
                            <div>
                              <p className="text-xs text-slate-500 mb-2 font-medium">Distribuição de tempo</p>
                              <div className="flex h-6 rounded-full overflow-hidden">
                                {metric.distribution.under5min > 0 && (
                                  <div
                                    className="bg-emerald-500 flex items-center justify-center text-[10px] text-white font-semibold"
                                    style={{ width: `${(metric.distribution.under5min / totalDist) * 100}%` }}
                                    title={`< 5min: ${metric.distribution.under5min}`}
                                  >
                                    {metric.distribution.under5min > 0 && metric.distribution.under5min}
                                  </div>
                                )}
                                {metric.distribution.under15min > 0 && (
                                  <div
                                    className="bg-yellow-500 flex items-center justify-center text-[10px] text-white font-semibold"
                                    style={{ width: `${(metric.distribution.under15min / totalDist) * 100}%` }}
                                    title={`5-15min: ${metric.distribution.under15min}`}
                                  >
                                    {metric.distribution.under15min}
                                  </div>
                                )}
                                {metric.distribution.under30min > 0 && (
                                  <div
                                    className="bg-orange-500 flex items-center justify-center text-[10px] text-white font-semibold"
                                    style={{ width: `${(metric.distribution.under30min / totalDist) * 100}%` }}
                                    title={`15-30min: ${metric.distribution.under30min}`}
                                  >
                                    {metric.distribution.under30min}
                                  </div>
                                )}
                                {metric.distribution.under1h > 0 && (
                                  <div
                                    className="bg-red-400 flex items-center justify-center text-[10px] text-white font-semibold"
                                    style={{ width: `${(metric.distribution.under1h / totalDist) * 100}%` }}
                                    title={`30-60min: ${metric.distribution.under1h}`}
                                  >
                                    {metric.distribution.under1h}
                                  </div>
                                )}
                                {metric.distribution.over1h > 0 && (
                                  <div
                                    className="bg-red-600 flex items-center justify-center text-[10px] text-white font-semibold"
                                    style={{ width: `${(metric.distribution.over1h / totalDist) * 100}%` }}
                                    title={`> 1h: ${metric.distribution.over1h}`}
                                  >
                                    {metric.distribution.over1h}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;5min</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 5-15min</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> 15-30min</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> 30-60min</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /> &gt;1h</span>
                              </div>
                            </div>
                          )}

                          {totalDist === 0 && (
                            <p className="text-sm text-slate-400 text-center py-2">Sem dados no período</p>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
            </div>

            {/* Log Recente */}
            <div>
              <h2 className="text-2xl font-bold text-[#1D2748] mb-1">Histórico de Respostas</h2>
              <p className="text-slate-500 text-sm mb-6">Últimas 50 conversas respondidas</p>

              <Card className="border-0 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200">
                      <tr>
                        <th className="text-left p-4 font-semibold text-sm text-slate-700">Contato</th>
                        <th className="text-left p-4 font-semibold text-sm text-slate-700">Respondido por</th>
                        <th className="text-center p-4 font-semibold text-sm text-slate-700">Tempo de Espera</th>
                        <th className="text-left p-4 font-semibold text-sm text-slate-700">Respondido em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recentLog.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500">
                            Nenhuma resposta registrada no período
                          </td>
                        </tr>
                      ) : (
                        data.recentLog.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white text-sm font-bold">
                                  {entry.displayName[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-[#1D2748]">{entry.displayName}</p>
                                  <p className="text-xs text-slate-500">{entry.displayPhone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-slate-400" />
                                <span className="text-sm text-slate-700 font-medium">{entry.respondedBy}</span>
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getResponseTimeBg(entry.responseTimeMs)} ${getResponseTimeColor(entry.responseTimeMs)}`}>
                                <Clock className="w-3.5 h-3.5 mr-1.5" />
                                {entry.responseTimeMs ? formatDuration(entry.responseTimeMs) : '-'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-slate-600">
                                {entry.respondedAt
                                  ? new Date(entry.respondedAt).toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : '-'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-slate-500">
            Erro ao carregar dados. Tente novamente.
          </div>
        )}
      </div>
    </div>
  )
}
