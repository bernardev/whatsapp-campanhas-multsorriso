// app/(dashboard)/leads/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  Flame,
  Search,
  ArrowLeft,
  Users,
  Phone,
  Clock,
  User,
  MessageSquare,
  Filter,
  Trash2
} from 'lucide-react'

interface Lead {
  id: string
  remoteJid: string
  displayName: string
  displayPhone: string
  status: 'NOVO' | 'EM_ATENDIMENTO' | 'FINALIZADO'
  isHot: boolean
  lastMessage: string
  lastMessageAt: Date
  assignedTo: {
    id: string
    name: string
  } | null
  campaign: {        // ✅ ADICIONA ISTO
    id: string
    name: string
  } | null
  notes: string | null
  createdAt: Date
}

type FilterType = 'all' | 'hot' | 'novo' | 'em_atendimento' | 'finalizado'

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadLeads()
    
    // Auto-refresh a cada 15 segundos
    const interval = setInterval(() => {
      loadLeads(true)
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  async function loadLeads(silent = false) {
    try {
      if (!silent) setLoading(true)
      
      const response = await fetch('/api/leads')
      const data = await response.json()
      setLeads(data.leads)
    } catch (error) {
      console.error('Erro ao carregar leads:', error)
    } finally {
      setLoading(false)
    }
  }

  async function toggleHotLead(leadId: string, currentIsHot: boolean) {
    try {
      setActionLoading(leadId)

      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHot: !currentIsHot })
      })

      if (!response.ok) throw new Error('Erro ao atualizar lead')

      await loadLeads(true)
    } catch (error) {
      console.error('Erro ao atualizar lead:', error)
      alert('Erro ao atualizar lead')
    } finally {
      setActionLoading(null)
    }
  }

  async function updateLeadStatus(leadId: string, newStatus: Lead['status']) {
    try {
      setActionLoading(leadId)

      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) throw new Error('Erro ao atualizar status')

      await loadLeads(true)
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      alert('Erro ao atualizar status')
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteLead(leadId: string, leadName: string) {
    if (!confirm(`Tem certeza que deseja descartar o lead de "${leadName}"?\n\nEsta ação não pode ser desfeita.`)) {
      return
    }

    try {
      setActionLoading(leadId)

      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erro ao excluir lead')

      await loadLeads(true)
      alert('Lead descartado com sucesso!')
    } catch (error) {
      console.error('Erro ao excluir lead:', error)
      alert('Erro ao excluir lead')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredLeads = leads.filter(lead => {
    // Filtro de tipo
    if (filterType === 'hot' && !lead.isHot) return false
    if (filterType === 'novo' && lead.status !== 'NOVO') return false
    if (filterType === 'em_atendimento' && lead.status !== 'EM_ATENDIMENTO') return false
    if (filterType === 'finalizado' && lead.status !== 'FINALIZADO') return false
    
    // Filtro de busca
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        lead.displayName.toLowerCase().includes(search) ||
        lead.displayPhone.includes(search) ||
        lead.lastMessage.toLowerCase().includes(search)
      )
    }
    
    return true
  })

  const hotCount = leads.filter(l => l.isHot).length
  const novoCount = leads.filter(l => l.status === 'NOVO').length
  const atendimentoCount = leads.filter(l => l.status === 'EM_ATENDIMENTO').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#BD8F29] mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Carregando leads...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/campanhas')}
              className="text-slate-600 hover:text-[#1D2748]"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[#1D2748] flex items-center gap-2">
                <Users className="w-8 h-8 text-[#BD8F29]" />
                Respostas Recebidas
              </h1>
              <p className="text-slate-600 mt-1">
                Gerencie leads e atribua para sua equipe
              </p>
            </div>
          </div>

          {/* Busca */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou mensagem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#BD8F29] focus:border-transparent text-sm transition-all"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
              className={filterType === 'all' ? 'bg-[#BD8F29] hover:bg-[#BD8F29]/90' : ''}
            >
              <Filter className="w-4 h-4 mr-1.5" />
              Todos ({leads.length})
            </Button>
            
            <Button
              variant={filterType === 'hot' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('hot')}
              className={filterType === 'hot' ? 'bg-orange-600 hover:bg-orange-700' : ''}
            >
              <Flame className="w-4 h-4 mr-1.5" />
              Leads Quentes ({hotCount})
            </Button>
            
            <Button
              variant={filterType === 'novo' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('novo')}
              className={filterType === 'novo' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              Novos ({novoCount})
            </Button>
            
            <Button
              variant={filterType === 'em_atendimento' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('em_atendimento')}
              className={filterType === 'em_atendimento' ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              Em Atendimento ({atendimentoCount})
            </Button>
            
            <Button
              variant={filterType === 'finalizado' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('finalizado')}
              className={filterType === 'finalizado' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              Finalizados
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Leads */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredLeads.length === 0 ? (
          <Card className="p-16 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#1D2748] mb-2">
              {searchTerm ? 'Nenhum lead encontrado' : 'Nenhum lead ainda'}
            </h3>
            <p className="text-slate-500">
              {searchTerm 
                ? 'Tente ajustar os filtros de busca' 
                : 'Leads aparecerão aqui quando clientes responderem'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredLeads.map((lead) => (
              <Card key={lead.id} className="p-6 hover:shadow-lg transition-all">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      lead.isHot 
                        ? 'bg-gradient-to-br from-orange-500 to-red-600' 
                        : 'bg-gradient-to-br from-[#BD8F29] to-[#BD8F29]/80'
                    }`}>
                      {lead.displayName[0]?.toUpperCase() || '?'}
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-[#1D2748]">
                            {lead.displayName}
                          </h3>
                          {lead.isHot && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                              <Flame className="w-3 h-3" />
                              Lead Quente
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          {lead.displayPhone}
                        </p>
                        
                        {/* ✅ MOSTRA A CAMPANHA AQUI */}
                        {lead.campaign && (
                          <p className="text-xs text-[#BD8F29] font-semibold flex items-center gap-1.5 mt-1">
                            Campanha: {lead.campaign.name}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right text-sm text-slate-500">
                        <div className="flex items-center gap-1 justify-end mb-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatRelativeTime(lead.lastMessageAt)}
                        </div>
                        {getStatusBadge(lead.status)}
                      </div>
                    </div>

                    <p className="text-sm text-slate-700 mb-4 line-clamp-2">
                      {lead.lastMessage} 💬
                    </p>

                    {/* Ações */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/conversas?remoteJid=${encodeURIComponent(lead.remoteJid)}`)}
                        className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                      >
                        <MessageSquare className="w-4 h-4 mr-1.5" />
                        Ver Conversa
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleHotLead(lead.id, lead.isHot)}
                        disabled={actionLoading === lead.id}
                        className={lead.isHot 
                          ? 'border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white' 
                          : 'border-slate-300'
                        }
                      >
                        <Flame className="w-4 h-4 mr-1.5" />
                        {lead.isHot ? 'Remover 🔥' : 'Marcar 🔥'}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteLead(lead.id, lead.displayName)}
                        disabled={actionLoading === lead.id}
                        className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Descartar
                      </Button>

                      {lead.status === 'NOVO' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateLeadStatus(lead.id, 'EM_ATENDIMENTO')}
                          disabled={actionLoading === lead.id}
                          className="border-purple-500 text-purple-600 hover:bg-purple-500 hover:text-white"
                        >
                          Iniciar Atendimento
                        </Button>
                      )}

                      {lead.status === 'EM_ATENDIMENTO' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateLeadStatus(lead.id, 'FINALIZADO')}
                          disabled={actionLoading === lead.id}
                          className="border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white"
                        >
                          Finalizar
                        </Button>
                      )}

                      {lead.assignedTo && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          <User className="w-3.5 h-3.5" />
                          {lead.assignedTo.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getStatusBadge(status: Lead['status']) {
  const styles = {
    NOVO: 'bg-blue-100 text-blue-700 border-blue-200',
    EM_ATENDIMENTO: 'bg-purple-100 text-purple-700 border-purple-200',
    FINALIZADO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }
  
  const labels = {
    NOVO: 'Novo',
    EM_ATENDIMENTO: 'Em Atendimento',
    FINALIZADO: 'Finalizado',
  }
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Agora'
  if (diffMins < 60) return `${diffMins}min atrás`
  if (diffHours < 24) return `${diffHours}h atrás`
  if (diffDays < 7) return `${diffDays}d atrás`
  
  return then.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}