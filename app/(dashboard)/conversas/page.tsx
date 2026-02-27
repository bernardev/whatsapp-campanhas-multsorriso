// app/(dashboard)/conversas/page.tsx
'use client'

import { useEffect, useState, useRef, memo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  MessageSquare, 
  Search,
  ArrowLeft,
  Users,
  Phone,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react'

interface Message {
  id: string
  messageText: string
  fromMe: boolean
  timestamp: Date
  pushName: string | null
}

interface Conversa {
  remoteJid: string
  displayName: string
  displayPhone: string
  isGroup: boolean
  lastMessage: string
  lastMessageAt: Date
  lastMessageFromMe: boolean
  needsResponse: boolean
  messages: Message[]
}

type FilterType = 'all' | 'pending' | 'responded'

const MessageInput = memo(({ 
  onSend, 
  disabled 
}: { 
  onSend: (msg: string) => Promise<void>
  disabled: boolean 
}) => {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!input.trim() || sending) return
    setSending(true)
    await onSend(input.trim())
    setInput('')
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-shrink-0 bg-white border-t border-slate-200 p-4">
      <div className="flex gap-3 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para quebrar linha)"
          disabled={disabled || sending}
          rows={1}
          className="flex-1 resize-none px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#BD8F29] focus:border-transparent text-sm transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
          style={{
            minHeight: '48px',
            maxHeight: '120px',
            overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden'
          }}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || sending || disabled}
          className="bg-[#BD8F29] hover:bg-[#BD8F29]/90 text-white px-6 py-3 h-12"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="font-semibold">Enviar</span>
          )}
        </Button>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        💡 Dica: Pressione Enter para enviar ou Shift+Enter para quebrar linha
      </p>
    </div>
  )
})
MessageInput.displayName = 'MessageInput'

export default function ConversasPage() {
  const router = useRouter()
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedConversa, setSelectedConversa] = useState<Conversa | null>(null)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const selectedConversaRef = useRef<Conversa | null>(null)
  const messagesRef = useRef<Message[]>([])

  async function syncConversas() {
    try {
      setSyncing(true)
      setSyncResult(null)

      const response = await fetch('/api/conversas/sync', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setSyncResult(data.message)
      await loadConversas(true)
    } catch (error) {
      console.error('Erro no sync:', error)
      setSyncResult('Erro ao sincronizar. Verifique a instância.')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    loadConversas()

    const interval = setInterval(() => {
      loadConversas(true)
      if (selectedConversaRef.current) {
        loadMessages(selectedConversaRef.current.remoteJid, true)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  async function loadMessages(remoteJid: string, silent = false) {
    try {
      if (!silent) {
        setLoadingMessages(true)
        setMessages([])
        messagesRef.current = []
      }

      const response = await fetch(
        `/api/conversas/${encodeURIComponent(remoteJid)}/mensagens`
      )
      const data = await response.json()

      if (response.ok) {
        // Só atualiza estado se quantidade de mensagens mudou
        if (data.mensagens.length !== messagesRef.current.length) {
          messagesRef.current = data.mensagens
          setMessages(data.mensagens)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
    } finally {
      if (!silent) setLoadingMessages(false)
    }
  }

  async function loadConversas(silent = false) {
    try {
      if (!silent) setLoading(true)

      const response = await fetch('/api/conversas')
      const data = await response.json()
      setConversas(data.conversas)

      if (selectedConversaRef.current) {
        const updated = data.conversas.find(
          (c: Conversa) => c.remoteJid === selectedConversaRef.current!.remoteJid
        )
        if (updated) setSelectedConversa(updated)
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function toggleResponseStatus(remoteJid: string, needsResponse: boolean) {
    try {
      setActionLoading(remoteJid)

      const method = needsResponse ? 'POST' : 'DELETE'
      const response = await fetch(
        `/api/conversas/${encodeURIComponent(remoteJid)}/marcar-respondido`,
        { method }
      )

      if (!response.ok) throw new Error('Erro ao atualizar status')

      await loadConversas(true)
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      alert('Erro ao atualizar status da conversa')
    } finally {
      setActionLoading(null)
    }
  }

  async function sendMessage() {
    if (!selectedConversa || !messageInput.trim()) return

    try {
      setSendingMessage(true)

      const response = await fetch(
        `/api/conversas/${encodeURIComponent(selectedConversa.remoteJid)}/enviar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageInput.trim() })
        }
      )

      if (!response.ok) throw new Error('Erro ao enviar')

      setMessageInput('')
      await loadMessages(selectedConversa.remoteJid, true)

      setTimeout(() => {
        const messagesDiv = document.querySelector('.messages-container')
        if (messagesDiv) {
          messagesDiv.scrollTop = messagesDiv.scrollHeight
        }
      }, 100)
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      alert('Erro ao enviar mensagem. Tente novamente.')
    } finally {
      setSendingMessage(false)
    }
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const filteredConversas = conversas
    .filter(conv => {
      if (filterType === 'pending' && !conv.needsResponse) return false
      if (filterType === 'responded' && conv.needsResponse) return false

      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        return (
          conv.displayName.toLowerCase().includes(search) ||
          conv.displayPhone.includes(search) ||
          conv.lastMessage.toLowerCase().includes(search)
        )
      }

      return true
    })
    .sort((a, b) => {
      if (a.needsResponse && !b.needsResponse) return -1
      if (!a.needsResponse && b.needsResponse) return 1
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    })

  const pendingCount = conversas.filter(c => c.needsResponse).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#BD8F29] mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Carregando conversas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50 flex">
      {/* Sidebar - Lista de conversas */}
      <div className={`${selectedConversa ? 'hidden md:flex' : 'flex w-full'} md:w-[420px] bg-white border-r border-slate-200 flex-col shadow-lg h-full`}>
        {/* Header fixo */}
        <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-gradient-to-br from-white to-slate-50/30">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/campanhas')}
              className="text-slate-600 hover:text-[#1D2748]"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#1D2748] flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-[#BD8F29]" />
                Conversas
              </h1>
              {pendingCount > 0 && (
                <p className="text-sm text-slate-600 mt-1">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold text-xs">
                    <AlertCircle className="w-3 h-3" />
                    {pendingCount} aguardando resposta
                  </span>
                </p>
              )}
            </div>

            {/* Botão Sincronizar */}
            <div className="mb-4">
              <Button
                onClick={syncConversas}
                disabled={syncing}
                variant="outline"
                size="sm"
                className="w-full border-[#BD8F29] text-[#BD8F29] hover:bg-[#BD8F29]/10"
              >
                {syncing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#BD8F29] border-t-transparent rounded-full animate-spin mr-2" />
                    Sincronizando...
                  </>
                ) : (
                  'Sincronizar conversas do WhatsApp'
                )}
              </Button>
              {syncResult && (
                <p className="text-xs text-center mt-1.5 text-slate-500">{syncResult}</p>
              )}
            </div>
          </div>

          {/* Busca */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#BD8F29] focus:border-transparent text-sm transition-all"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
              className={filterType === 'all' ? 'bg-[#BD8F29] hover:bg-[#BD8F29]/90' : ''}
            >
              Todas ({conversas.length})
            </Button>
            <Button
              variant={filterType === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('pending')}
              className={filterType === 'pending' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              Sem resposta ({pendingCount})
            </Button>
            <Button
              variant={filterType === 'responded' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('responded')}
              className={filterType === 'responded' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              Respondidas ({conversas.length - pendingCount})
            </Button>
          </div>
        </div>

        {/* Lista de conversas com scroll próprio */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversas.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">
                {searchTerm ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
              </p>
            </div>
          ) : (
            filteredConversas.map((conversa) => (
              <div
                key={conversa.remoteJid}
                onClick={() => {
                  setSelectedConversa(conversa)
                  selectedConversaRef.current = conversa
                  loadMessages(conversa.remoteJid)
                }}
                className={`p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-all ${
                  selectedConversa?.remoteJid === conversa.remoteJid
                    ? 'bg-[#BD8F29]/5 border-l-4 border-l-[#BD8F29]'
                    : ''
                } ${conversa.needsResponse ? 'bg-red-50/30' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                      conversa.needsResponse
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : 'bg-gradient-to-br from-[#BD8F29] to-[#BD8F29]/80'
                    }`}>
                      {conversa.isGroup ? (
                        <Users className="w-6 h-6" />
                      ) : (
                        conversa.displayName[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    {conversa.needsResponse && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white flex items-center justify-center">
                        <AlertCircle className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm truncate">
                          {conversa.displayName}
                        </h3>
                        {!conversa.isGroup && (
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {conversa.displayPhone}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 ml-2 whitespace-nowrap">
                        {formatRelativeTime(conversa.lastMessageAt)}
                      </span>
                    </div>

                    <p className={`text-sm truncate ${
                      conversa.needsResponse ? 'text-slate-700 font-medium' : 'text-slate-600'
                    }`}>
                      {conversa.lastMessageFromMe && '✓ '}
                      {conversa.lastMessage}
                    </p>

                    {conversa.needsResponse && (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          <Clock className="w-3 h-3" />
                          Aguardando resposta
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-br from-slate-50 to-white">
        {selectedConversa ? (
          <>
            {/* Header fixo */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden"
                    onClick={() => setSelectedConversa(null)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                    selectedConversa.needsResponse
                      ? 'bg-gradient-to-br from-red-500 to-red-600'
                      : 'bg-gradient-to-br from-[#BD8F29] to-[#BD8F29]/80'
                  }`}>
                    {selectedConversa.isGroup ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      selectedConversa.displayName[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">{selectedConversa.displayName}</h2>
                    {!selectedConversa.isGroup && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedConversa.displayPhone}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={selectedConversa.needsResponse ? 'default' : 'outline'}
                  onClick={() => toggleResponseStatus(selectedConversa.remoteJid, selectedConversa.needsResponse)}
                  disabled={actionLoading === selectedConversa.remoteJid}
                  className={selectedConversa.needsResponse
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'border-slate-300'
                  }
                >
                  {actionLoading === selectedConversa.remoteJid ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : selectedConversa.needsResponse ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Marcar como respondido
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-1.5" />
                      Marcar como não respondido
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Mensagens com scroll próprio */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 messages-container">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#BD8F29] mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Carregando mensagens...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-400">Nenhuma mensagem encontrada</p>
                </div>
              ) : (
                messages.slice().reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                        msg.fromMe
                          ? 'bg-gradient-to-br from-[#BD8F29] to-[#BD8F29]/90 text-white'
                          : 'bg-white text-slate-900 border border-slate-200'
                      }`}
                    >
                      {!msg.fromMe && msg.pushName && (
                        <p className="text-xs font-semibold mb-1.5 text-[#BD8F29]">
                          {msg.pushName}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {msg.messageText}
                      </p>
                      <p className={`text-xs mt-1.5 ${msg.fromMe ? 'text-white/80' : 'text-slate-500'}`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Onde estava o footer com textarea, substitui por: */}
            <MessageInput
              onSend={async (msg) => {
                const response = await fetch(
                  `/api/conversas/${encodeURIComponent(selectedConversa.remoteJid)}/enviar`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg })
                  }
                )
                if (!response.ok) throw new Error('Erro ao enviar')
                await loadMessages(selectedConversa.remoteJid, true)
              }}
              disabled={false}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#BD8F29]/10 to-[#BD8F29]/5 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-[#BD8F29]" />
              </div>
              <h3 className="text-xl font-bold text-[#1D2748] mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-slate-500">
                Escolha uma conversa na lista para visualizar o histórico
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
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
  if (diffMins < 60) return `${diffMins}min`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`

  return then.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}