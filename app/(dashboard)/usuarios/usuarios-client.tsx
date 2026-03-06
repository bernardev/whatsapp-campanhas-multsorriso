// app/(dashboard)/usuarios/usuarios-client.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import Image from 'next/image'
import {
  BarChart3,
  Users,
  MessageSquare,
  Smartphone,
  Bell,
  Check,
  UserPlus,
  Trash2,
  Shield,
  ShieldCheck,
  Clock,
  Loader2,
  Eye,
  EyeOff,
  Pencil,
  Activity,
  UserCog
} from 'lucide-react'

interface UserData {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'USER'
  lastLoginAt: string | null
  createdAt: string
  _count: {
    conversationResponses: number
  }
}

interface Notificacao {
  id: string
  type: string
  clientName: string
  phone: string
  remoteJid: string
  lastMessage: string
  waitingMinutes: number
  timestamp: Date
}

interface UsuariosClientProps {
  user: {
    id: string
    name: string
    email: string
    role: 'ADMIN' | 'USER'
  }
}

export default function UsuariosClient({ user }: UsuariosClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<'ADMIN' | 'USER'>('USER')

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    loadNotificacoes()
    const interval = setInterval(loadNotificacoes, 2000)
    return () => clearInterval(interval)
  }, [])

  async function loadUsers() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/usuarios')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
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

  function openCreateForm() {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('USER')
    setShowForm(true)
  }

  function openEditForm(u: UserData) {
    setEditingUser(u)
    setFormName(u.name)
    setFormEmail(u.email)
    setFormPassword('')
    setFormRole(u.role)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('USER')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      if (editingUser) {
        // Atualizar
        const body: Record<string, string> = { name: formName, role: formRole }
        if (formPassword) body.password = formPassword

        const res = await fetch(`/api/admin/usuarios/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })

        if (!res.ok) {
          const data = await res.json()
          alert(data.error || 'Erro ao atualizar')
          return
        }
      } else {
        // Criar
        if (!formPassword) {
          alert('Senha é obrigatória para novo usuário')
          return
        }

        const res = await fetch('/api/admin/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            password: formPassword,
            role: formRole
          })
        })

        if (!res.ok) {
          const data = await res.json()
          alert(data.error || 'Erro ao criar')
          return
        }
      }

      closeForm()
      await loadUsers()
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao salvar usuário')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: UserData) {
    if (u.id === user.id) {
      alert('Você não pode excluir sua própria conta')
      return
    }

    if (!confirm(`Tem certeza que deseja excluir o usuário "${u.name}"?\n\nEsta ação não pode ser desfeita.`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Erro ao excluir')
        return
      }
      await loadUsers()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir usuário')
    }
  }

  async function handleLogout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const isActive = (path: string): boolean => pathname.startsWith(path)

  function formatDate(date: string | null): string {
    if (!date) return 'Nunca'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatRelativeTime(date: string | null): string {
    if (!date) return 'Nunca acessou'
    const now = new Date()
    const then = new Date(date)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins}min atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 30) return `${diffDays}d atrás`
    return formatDate(date)
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

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header da página */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1D2748]">Gestão de Usuários</h1>
            <p className="text-slate-500 mt-1">Crie, edite e gerencie os acessos da equipe</p>
          </div>
          <Button
            onClick={openCreateForm}
            className="bg-[#BD8F29] hover:bg-[#A67B1E] text-white font-semibold"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#BD8F29]" />
          </div>
        )}

        {/* Lista de usuários */}
        {!loading && (
          <div className="grid gap-4">
            {users.map((u) => (
              <Card key={u.id} className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                        u.role === 'ADMIN' ? 'bg-[#BD8F29]' : 'bg-[#1D2748]'
                      }`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[#1D2748] text-lg">{u.name}</h3>
                          {u.role === 'ADMIN' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#BD8F29]/10 text-[#BD8F29]">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                              <Shield className="w-3 h-3" />
                              Usuário
                            </span>
                          )}
                          {u.id === user.id && (
                            <span className="text-xs text-slate-400">(você)</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{u.email}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Último login: {formatRelativeTime(u.lastLoginAt)}
                          </span>
                          <span className="text-xs text-slate-400">
                            Criado em {formatDate(u.createdAt)}
                          </span>
                          {u._count.conversationResponses > 0 && (
                            <span className="text-xs text-slate-400">
                              {u._count.conversationResponses} respostas
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditForm(u)}
                        className="border-slate-200 text-slate-600 hover:text-[#BD8F29] hover:border-[#BD8F29]"
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      {u.id !== user.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(u)}
                          className="border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Resumo */}
        {!loading && users.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-slate-200">
              <CardHeader className="pb-2">
                <p className="text-xs font-medium text-slate-500 uppercase">Total</p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#1D2748]">{users.length}</p>
                <p className="text-xs text-slate-400">usuários cadastrados</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200">
              <CardHeader className="pb-2">
                <p className="text-xs font-medium text-slate-500 uppercase">Admins</p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#BD8F29]">{users.filter(u => u.role === 'ADMIN').length}</p>
                <p className="text-xs text-slate-400">com acesso total</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200">
              <CardHeader className="pb-2">
                <p className="text-xs font-medium text-slate-500 uppercase">Usuários</p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#1D2748]">{users.filter(u => u.role === 'USER').length}</p>
                <p className="text-xs text-slate-400">acesso limitado</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={closeForm} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-[#1D2748]">
                  {editingUser ? `Editar: ${editingUser.name}` : 'Novo Usuário'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {editingUser ? 'Altere os dados abaixo' : 'Preencha os dados do novo usuário'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#BD8F29]/50 focus:border-[#BD8F29]"
                    placeholder="Nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                    disabled={!!editingUser}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#BD8F29]/50 focus:border-[#BD8F29] disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Senha {editingUser && <span className="text-slate-400 font-normal">(deixe vazio para manter)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required={!editingUser}
                      className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#BD8F29]/50 focus:border-[#BD8F29]"
                      placeholder={editingUser ? 'Nova senha (opcional)' : 'Senha'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Perfil de Acesso</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormRole('USER')}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        formRole === 'USER'
                          ? 'border-[#1D2748] bg-[#1D2748]/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Shield className={`w-5 h-5 mb-1 ${formRole === 'USER' ? 'text-[#1D2748]' : 'text-slate-400'}`} />
                      <p className={`text-sm font-semibold ${formRole === 'USER' ? 'text-[#1D2748]' : 'text-slate-600'}`}>Usuário</p>
                      <p className="text-xs text-slate-400">Campanhas, contatos e conversas</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormRole('ADMIN')}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        formRole === 'ADMIN'
                          ? 'border-[#BD8F29] bg-[#BD8F29]/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <ShieldCheck className={`w-5 h-5 mb-1 ${formRole === 'ADMIN' ? 'text-[#BD8F29]' : 'text-slate-400'}`} />
                      <p className={`text-sm font-semibold ${formRole === 'ADMIN' ? 'text-[#BD8F29]' : 'text-slate-600'}`}>Admin</p>
                      <p className="text-xs text-slate-400">Acesso total ao sistema</p>
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeForm}
                    className="flex-1 border-slate-200"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#BD8F29] hover:bg-[#A67B1E] text-white font-semibold"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {editingUser ? 'Salvar' : 'Criar Usuário'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
