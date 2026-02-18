// app/(dashboard)/campanhas/dashboard-client.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import Image from 'next/image'
import { 
  Plus, 
  Send, 
  Users, 
  MessageSquare, 
  CheckCircle, 
  TrendingUp,
  Clock,
  BarChart3,
  ArrowUpRight,
  Eye,
  PlayCircle,
  Loader2,
  Trash2,
  Bell,
  Check,
  Smartphone
} from 'lucide-react'
import { CampaignStatus } from '@/types/campaign'

type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'

interface Message {
  status: MessageStatus
}

interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  createdAt: Date
  _count: {
    messages: number
    contacts: number
  }
  messages: Message[]
}

interface DashboardClientProps {
  user: {
    id: string
    name: string
    email: string
  }
  stats: {
    totalCampanhas: number
    campanhasAtivas: number
    totalContatos: number
    mensagensEnviadas: number
    taxaEntrega: number
  }
  campanhas: Campaign[]
}

// ✅ ADICIONADO: Interface de Notificação
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

export default function DashboardClient({ user, stats, campanhas }: DashboardClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [loadingCampaignId, setLoadingCampaignId] = useState<string | null>(null)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)
  
  // ✅ ADICIONADO: Estados de notificação
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // ✅ ADICIONADO: Carregar notificações
  async function loadNotificacoes() {
    try {
      const response = await fetch('/api/notificacoes')
      const data = await response.json()
      setNotificacoes(data.notificacoes || [])
    } catch (error) {
      console.error('Erro ao carregar notificações:', error)
    }
  }

  // ✅ ADICIONADO: useEffect para carregar notificações
  useEffect(() => {
    loadNotificacoes()
    
    const interval = setInterval(() => {
      loadNotificacoes()
    }, 30000) // Atualiza a cada 30 segundos
    
    return () => clearInterval(interval)
  }, [])

  async function handleLogout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleNovaCampanha = (): void => {
    router.push('/campanhas/nova')
  }

  const handleEnviarCampanha = async (campaignId: string): Promise<void> => {
    if (!confirm('Deseja iniciar o envio desta campanha?')) {
      return
    }

    setLoadingCampaignId(campaignId)

    try {
      const response = await fetch(`/api/campanhas/${campaignId}/enviar`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error || 'Erro ao enviar campanha')
      }

      const result = await response.json() as { messagesQueued: number }
      
      alert(`Campanha iniciada! ${result.messagesQueued} mensagens na fila.`)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao enviar campanha')
    } finally {
      setLoadingCampaignId(null)
    }
  }

  async function handleExcluirCampanha(campaignId: string, campaignName: string, campaignStatus: CampaignStatus): Promise<void> {
    const message = campaignStatus === 'RUNNING' 
      ? `⚠️ ATENÇÃO! Esta campanha está EM EXECUÇÃO!\n\nTem certeza que deseja excluir "${campaignName}"?\n\nIsso vai CANCELAR todos os envios pendentes!\n\nEsta ação não pode ser desfeita.`
      : `Tem certeza que deseja excluir a campanha "${campaignName}"?\n\nEsta ação não pode ser desfeita.`
      
    if (!confirm(message)) {
      return
    }

    setDeletingCampaignId(campaignId)

    try {
      const response = await fetch(`/api/campanhas/${campaignId}/excluir`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error || 'Erro ao excluir campanha')
      }

      alert('Campanha excluída com sucesso!')
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao excluir campanha')
    } finally {
      setDeletingCampaignId(null)
    }
  }

  const isActive = (path: string): boolean => {
    return pathname.startsWith(path)
  }

  const getStatusBadge = (status: CampaignStatus) => {
    const styles: Record<CampaignStatus, string> = {
      DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
      RUNNING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      COMPLETED: 'bg-blue-50 text-blue-700 border-blue-200',
      SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
      PAUSED: 'bg-orange-50 text-orange-700 border-orange-200',
      CANCELLED: 'bg-red-50 text-red-700 border-red-200',
    }
    const labels: Record<CampaignStatus, string> = {
      DRAFT: 'Rascunho',
      RUNNING: 'Em Execução',
      COMPLETED: 'Concluída',
      SCHEDULED: 'Agendada',
      PAUSED: 'Pausada',
      CANCELLED: 'Cancelada',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // ✅ ADICIONADO: Função formatRelativeTime
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

  const calculateStats = (messages: Message[]) => {
    const enviadas = messages.filter(m => 
      ['SENT', 'DELIVERED', 'READ'].includes(m.status)
    ).length
    const entregues = messages.filter(m => 
      ['DELIVERED', 'READ'].includes(m.status)
    ).length
    return { enviadas, entregues }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header Moderno com Navegação */}
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
              
              {/* Menu de Navegação */}
              <nav className="hidden md:flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => router.push('/campanhas')}
                  className={`flex items-center gap-2 ${
                    isActive('/campanhas') && !isActive('/conversas')
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
                  className={`flex items-center gap-2 cursor-pointer ${
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
              </nav>
            </div>

            {/* ✅ MODIFICADO: Área direita com Notificações */}
            <div className="flex items-center gap-3">
              {/* Botão de Notificações */}
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
                
                {/* Dropdown de Notificações */}
                {showNotifications && (
                  <>
                    {/* Overlay para fechar ao clicar fora */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowNotifications(false)}
                    />
                    
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
                      
                      <div className="max-h-[500px] overflow-y-auto">
                        {notificacoes.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm text-slate-500 font-medium">
                              Nenhuma notificação
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Todas as conversas foram respondidas!
                            </p>
                          </div>
                        ) : (
                          notificacoes.map((notif) => (
                            <button
                              key={notif.id}
                              onClick={() => {
                                setShowNotifications(false)
                                router.push(`/conversas?remoteJid=${encodeURIComponent(notif.remoteJid)}`)
                              }}
                              className={`w-full p-4 hover:bg-slate-50 text-left transition-all border-l-4 ${
                                notif.type === 'nova_resposta' 
                                  ? 'border-l-blue-500 bg-blue-50/30'
                                  : notif.type === 'aguardando_10min'
                                  ? 'border-l-yellow-500 bg-yellow-50/30'
                                  : notif.type === 'aguardando_30min'
                                  ? 'border-l-orange-500 bg-orange-50/30'
                                  : 'border-l-red-500 bg-red-50/30'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Avatar */}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold ${
                                  notif.type === 'nova_resposta' 
                                    ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                                    : notif.type === 'aguardando_10min'
                                    ? 'bg-gradient-to-br from-yellow-500 to-yellow-600'
                                    : notif.type === 'aguardando_30min'
                                    ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                                    : 'bg-gradient-to-br from-red-500 to-red-600'
                                }`}>
                                  {notif.clientName[0]?.toUpperCase() || '?'}
                                </div>
                                
                                {/* Conteúdo */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm text-[#1D2748] mb-1">
                                    {notif.clientName}
                                  </p>
                                  
                                  {notif.type === 'nova_resposta' && (
                                    <p className="text-xs text-blue-700 font-medium mb-1">
                                      💬 Respondeu e está aguardando
                                    </p>
                                  )}
                                  
                                  {notif.type === 'aguardando_10min' && (
                                    <p className="text-xs text-yellow-700 font-medium mb-1 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Aguardando há {notif.waitingMinutes} minutos
                                    </p>
                                  )}
                                  
                                  {notif.type === 'aguardando_30min' && (
                                    <p className="text-xs text-orange-700 font-medium mb-1 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      ⚠️ Aguardando há {notif.waitingMinutes} minutos
                                    </p>
                                  )}
                                  
                                  {notif.type === 'aguardando_1h' && (
                                    <p className="text-xs text-red-700 font-medium mb-1 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      🚨 Aguardando há {Math.floor(notif.waitingMinutes / 60)}h {notif.waitingMinutes % 60}min
                                    </p>
                                  )}
                                  
                                  <p className="text-xs text-slate-600 truncate">
                                    {notif.lastMessage}...
                                  </p>
                                  
                                  <p className="text-xs text-slate-400 mt-1">
                                    {formatRelativeTime(notif.timestamp)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      
{notificacoes.length > 0 && (
  <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2">
    {/* Botão Marcar todas como lidas */}
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            // Marca todas como lidas
            const remoteJids = notificacoes.map(notif => notif.remoteJid)

            await fetch('/api/notificacoes/marcar-lidas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ remoteJids })
            })
            
            // Recarrega notificações
            await loadNotificacoes()
            
            // Fecha dropdown
            setShowNotifications(false)
          } catch (error) {
            console.error('Erro ao marcar como lidas:', error)
            alert('Erro ao marcar notificações como lidas')
          }
        }}
        className="w-full border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white font-semibold"
      >
        <Check className="w-4 h-4 mr-1.5" />
        Marcar todas como lidas
      </Button>
    
    {/* Botão Ver todas */}
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setShowNotifications(false)
        router.push('/conversas?filter=pending')
      }}
      className="w-full text-[#BD8F29] hover:text-[#BD8F29] hover:bg-[#BD8F29]/10 font-semibold"
    >
      Ver todas as conversas
    </Button>
  </div>
)}
                    </div>
                  </>
                )}
              </div>

              {/* User Dropdown */}
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

      {/* Main Content - RESTO DO CÓDIGO IGUAL */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header com gradiente */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#1D2748]/5 to-[#BD8F29]/5 rounded-3xl blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-8 h-8 text-[#BD8F29]" />
              <h1 className="text-4xl font-bold text-[#1D2748]">
                Dashboard
              </h1>
            </div>
            <p className="text-slate-600 text-lg">
              Acompanhe o desempenho das suas campanhas em tempo real
            </p>
          </div>
        </div>

        {/* Stats Cards Modernos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
          {/* Card 1 - Total de Campanhas */}
          <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-slate-50/30 overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#BD8F29]/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-600 font-medium">Total de Campanhas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-bold text-[#1D2748] mb-1">
                    {stats.totalCampanhas}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <TrendingUp className="w-3 h-3" />
                    <span>Todas as campanhas</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-[#BD8F29] to-[#BD8F29]/80 shadow-lg shadow-[#BD8F29]/20">
                  <Send className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2 - Campanhas Ativas */}
          <Card className="border-0 shadow-lg shadow-emerald-200/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-emerald-50/30 overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-600 font-medium">Campanhas Ativas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-bold text-emerald-600 mb-1">
                    {stats.campanhasAtivas}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-emerald-600">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium">Em execução</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3 - Total de Contatos */}
          <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50/30 overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-600 font-medium">Total de Contatos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-bold text-[#1D2748] mb-1">
                    {stats.totalContatos.toLocaleString('pt-BR')}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Users className="w-3 h-3" />
                    <span>Cadastrados</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4 - Mensagens Enviadas */}
          <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-purple-50/30 overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-600 font-medium">Mensagens Enviadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-bold text-[#1D2748] mb-1">
                    {stats.mensagensEnviadas.toLocaleString('pt-BR')}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MessageSquare className="w-3 h-3" />
                    <span>Total processado</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 5 - Taxa de Entrega */}
          <Card className="border-0 shadow-lg shadow-emerald-200/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-emerald-50/30 overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-600 font-medium">Taxa de Entrega</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-bold text-emerald-600 mb-1">
                    {stats.taxaEntrega}%
                  </div>
                  <div className="flex items-center gap-1 text-xs text-emerald-600">
                    <ArrowUpRight className="w-3 h-3" />
                    <span className="font-medium">Desempenho</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seção de Campanhas */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#1D2748] mb-1">
              {campanhas.length > 0 ? 'Campanhas Recentes' : 'Suas Campanhas'}
            </h2>
            <p className="text-slate-500 text-sm">
              {campanhas.length > 0 
                ? `${campanhas.length} campanha${campanhas.length > 1 ? 's' : ''} encontrada${campanhas.length > 1 ? 's' : ''}`
                : 'Comece criando sua primeira campanha'
              }
            </p>
          </div>
          <Button 
            onClick={handleNovaCampanha}
            className="text-white font-semibold shadow-lg shadow-[#BD8F29]/20 hover:shadow-xl hover:shadow-[#BD8F29]/30 transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Campanha
          </Button>
        </div>

        {/* Tabela ou Empty State */}
        {campanhas.length > 0 ? (
          <Card className="border-0 shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm text-slate-700">Nome da Campanha</th>
                    <th className="text-left p-4 font-semibold text-sm text-slate-700">Status</th>
                    <th className="text-center p-4 font-semibold text-sm text-slate-700">Mensagens</th>
                    <th className="text-center p-4 font-semibold text-sm text-slate-700">Enviadas</th>
                    <th className="text-center p-4 font-semibold text-sm text-slate-700">Entregues</th>
                    <th className="text-left p-4 font-semibold text-sm text-slate-700">Criada em</th>
                    <th className="text-center p-4 font-semibold text-sm text-slate-700">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campanhas.map((campanha) => {
                    const { enviadas, entregues } = calculateStats(campanha.messages)
                    const total = campanha._count.messages
                    const taxaEntrega = total > 0 ? Math.round((entregues / total) * 100) : 0
                    
                    return (
                      <tr 
                        key={campanha.id}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-[#BD8F29]/10 to-[#BD8F29]/5 group-hover:from-[#BD8F29]/20 group-hover:to-[#BD8F29]/10 transition-all">
                              <Send className="w-4 h-4 text-[#BD8F29]" />
                            </div>
                            <span className="font-semibold text-[#1D2748]">
                              {campanha.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">{getStatusBadge(campanha.status)}</td>
                        <td className="p-4 text-center">
                          <span className="font-medium text-slate-700">{total}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-medium text-slate-700">{enviadas}</span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-medium text-slate-700">{entregues}</span>
                            <span className="text-xs text-slate-500">({taxaEntrega}%)</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm">{formatDate(campanha.createdAt)}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            {campanha.status === 'DRAFT' && (
                              <Button 
                                size="sm"
                                onClick={() => handleEnviarCampanha(campanha.id)}
                                disabled={loadingCampaignId === campanha.id}
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700"
                              >
                                {loadingCampaignId === campanha.id ? (
                                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                ) : (
                                  <PlayCircle className="w-4 h-4 mr-1.5" />
                                )}
                                Enviar
                              </Button>
                            )}
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => router.push(`/campanhas/${campanha.id}/dashboard`)}
                              className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white transition-all font-medium"
                            >
                              <BarChart3 className="w-4 h-4 mr-1.5" />
                              Dashboard
                            </Button>

                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-[#BD8F29] text-[#BD8F29] hover:bg-[#BD8F29] hover:text-white transition-all font-medium"
                            >
                              <Eye className="w-4 h-4 mr-1.5" />
                              Detalhes
                            </Button>

                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleExcluirCampanha(campanha.id, campanha.name, campanha.status)}
                              disabled={deletingCampaignId === campanha.id}
                              className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white transition-all font-medium"
                            >
                              {deletingCampaignId === campanha.id ? (
                                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 mr-1.5" />
                              )}
                              Excluir
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="border-0 shadow-xl shadow-slate-200/50 overflow-hidden">
            <CardContent className="p-16 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#BD8F29]/10 to-[#BD8F29]/5 flex items-center justify-center">
                  <Send className="w-10 h-10 text-[#BD8F29]" />
                </div>
                <h3 className="text-xl font-bold text-[#1D2748] mb-2">
                  Nenhuma campanha criada ainda
                </h3>
                <p className="text-slate-500 mb-6">
                  Crie sua primeira campanha de WhatsApp e comece a alcançar seus contatos de forma profissional
                </p>
                <Button 
                  onClick={handleNovaCampanha}
                  className="text-white font-semibold shadow-lg shadow-[#BD8F29]/20 hover:shadow-xl hover:shadow-[#BD8F29]/30 transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90"
                  size="lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Criar Primeira Campanha
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}