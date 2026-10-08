// app/(dashboard)/contatos/contatos-client.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Image from 'next/image'
import { 
  Plus, 
  Upload, 
  Users, 
  Search,
  Trash2,
  Edit,
  Phone,
  Building2,
  Shield,
  ShieldOff,
  Ban,
  Clock,
  AlertTriangle,
  X,
  Loader2
} from 'lucide-react'

interface Contact {
  id: string
  phone: string
  name: string | null
  company: string | null
  blacklisted: boolean
  blacklistedAt: Date | null
  blacklistReason: string | null
  blacklistedBy: string | null
  createdAt: Date
}

interface ContatosClientProps {
  user: {
    id: string
    name: string
    email: string
    role: 'ADMIN' | 'USER'
  }
  contatos: Contact[]
  counts: { ativos: number; blacklist: number; todos: number }
  totalInicial: number
  pageSize: number
}

type TabType = 'all' | 'blacklist'

export default function ContatosClient({
  user,
  contatos: contatosIniciais,
  counts: countsIniciais,
  totalInicial,
  pageSize,
}: ContatosClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabType>('all')
  // A lista agora vem paginada do servidor. O estado abaixo espelha a resposta
  // de GET /api/contatos; a primeira página chega pronta via props.
  const [contatos, setContatos] = useState<Contact[]>(contatosIniciais)
  const [counts, setCounts] = useState(countsIniciais)
  const [total, setTotal] = useState<number>(totalInicial)
  const [page, setPage] = useState<number>(1)
  const [carregando, setCarregando] = useState<boolean>(false)
  const primeiraRenderizacao = useRef<boolean>(true)
  const [unblockingId, setUnblockingId] = useState<string | null>(null)
  const [blockingId, setBlockingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Edição de contato (modal)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', company: '' })
  const [savingEdit, setSavingEdit] = useState<boolean>(false)
  const [editError, setEditError] = useState<string | null>(null)

  const openEdit = (contato: Contact): void => {
    setEditError(null)
    setEditingContact(contato)
    setEditForm({
      name: contato.name || '',
      // phone vem normalizado (só dígitos). Reexibe no formato +55... esperado pela API.
      phone: contato.phone.startsWith('+') ? contato.phone : `+${contato.phone}`,
      company: contato.company || '',
    })
  }

  const closeEdit = (): void => {
    if (savingEdit) return
    setEditingContact(null)
    setEditError(null)
  }

  const handleSaveEdit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!editingContact) return

    setSavingEdit(true)
    setEditError(null)

    try {
      const response = await fetch(`/api/contatos/${editingContact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar contato')
      }

      setEditingContact(null)
      await carregar()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Erro ao atualizar contato')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (contato: Contact): Promise<void> => {
    if (!confirm(`Tem certeza que deseja excluir o contato "${contato.name || contato.phone}"?\n\nEsta ação não pode ser desfeita.`)) {
      return
    }

    try {
      setDeletingId(contato.id)

      const response = await fetch(`/api/contatos/${contato.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao excluir contato')
      }

      await carregar()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao excluir contato')
    } finally {
      setDeletingId(null)
    }
  }

  const handleLogout = async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleNovoContato = (): void => {
    router.push('/contatos/novo')
  }

  const handleImportarCSV = (): void => {
    router.push('/contatos/importar')
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value)
  }

  const handleUnblock = async (contactId: string): Promise<void> => {
    if (!confirm('Deseja desbloquear este contato?')) return

    try {
      setUnblockingId(contactId)

      const response = await fetch(`/api/contatos/${contactId}/desbloquear`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Erro ao desbloquear')

      await carregar()
    } catch (error) {
      console.error('Erro ao desbloquear:', error)
      alert('Erro ao desbloquear contato')
    } finally {
      setUnblockingId(null)
    }
  }

  const handleBlock = async (contact: Contact): Promise<void> => {
    const label = contact.name || contact.phone
    if (!confirm(`Bloquear "${label}"? Ele deixará de receber campanhas.`)) return

    try {
      setBlockingId(contact.id)

      const response = await fetch(`/api/contatos/${contact.id}/bloquear`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Erro ao bloquear')

      await carregar()
    } catch (error) {
      console.error('Erro ao bloquear:', error)
      alert('Erro ao bloquear contato')
    } finally {
      setBlockingId(null)
    }
  }

  // Busca no servidor. Debounce de 350ms para nao disparar a cada tecla.
  const carregar = useCallback(async (): Promise<void> => {
    setCarregando(true)
    try {
      const qs = new URLSearchParams({
        tab: activeTab,
        q: searchTerm,
        page: String(page),
      })
      const res = await fetch(`/api/contatos?${qs.toString()}`)
      if (!res.ok) throw new Error('falha ao listar')
      const data = await res.json()
      setContatos(data.contatos || [])
      setTotal(data.total || 0)
      if (data.counts) setCounts(data.counts)
    } catch (error) {
      console.error('Erro ao carregar contatos:', error)
    } finally {
      setCarregando(false)
    }
  }, [activeTab, searchTerm, page])

  useEffect(() => {
    // A primeira pagina ja veio pronta do servidor.
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false
      return
    }
    const t = setTimeout(carregar, 350)
    return () => clearTimeout(t)
  }, [carregar])

  // Trocar de aba ou de busca volta para a primeira pagina.
  useEffect(() => {
    setPage(1)
  }, [activeTab, searchTerm])

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize))

  // O servidor ja devolve filtrado por aba e por busca.
  const contatosFiltrados = contatos

  const formatPhone = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 13) {
      return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`
    }
    return phone
  }

  const formatDate = (date: Date | null): string => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const blacklistedCount = counts.blacklist
  const activeCount = counts.ativos

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Image
                src="/logo-multsorriso.png"
                alt="MultSorriso"
                width={140}
                height={56}
                className="object-contain cursor-pointer"
                onClick={() => router.push('/campanhas')}
              />
            </div>
            <div className="flex items-center gap-4">
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-[#BD8F29]" />
            <h1 className="text-4xl font-bold text-[#1D2748]">
              Contatos
            </h1>
          </div>
          <p className="text-slate-600 text-lg">
            Gerencie sua lista de contatos e blacklist
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-2">
          <Button
            variant={activeTab === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveTab('all')}
            className={activeTab === 'all' ? 'bg-[#BD8F29] hover:bg-[#BD8F29]/90' : ''}
          >
            <Users className="w-4 h-4 mr-2" />
            Ativos ({activeCount})
          </Button>
          <Button
            variant={activeTab === 'blacklist' ? 'default' : 'outline'}
            onClick={() => setActiveTab('blacklist')}
            className={activeTab === 'blacklist' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            <ShieldOff className="w-4 h-4 mr-2" />
            Blacklist ({blacklistedCount})
          </Button>
        </div>

        {/* Actions Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Buscar por nome, telefone ou empresa..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>

          {activeTab === 'all' && (
            <div className="flex gap-3 w-full sm:w-auto">
              <Button 
                onClick={handleImportarCSV}
                variant="outline"
                className="flex-1 sm:flex-none border-[#BD8F29] text-[#BD8F29] hover:bg-[#BD8F29]/10"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar CSV
              </Button>
              <Button 
                onClick={handleNovoContato}
                className="flex-1 sm:flex-none bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Contato
              </Button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total de Contatos</p>
                  <p className="text-3xl font-bold text-[#1D2748]">
                    {counts.todos}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-[#BD8F29] to-[#BD8F29]/80">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Contatos Ativos</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {activeCount}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600">
                  <Phone className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Bloqueados</p>
                  <p className="text-3xl font-bold text-red-600">
                    {blacklistedCount}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-red-600">
                  <ShieldOff className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        {contatosFiltrados.length > 0 ? (
          <Card className="border-0 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm text-slate-700">
                      Nome
                    </th>
                    <th className="text-left p-4 font-semibold text-sm text-slate-700">
                      Telefone
                    </th>
                    {activeTab === 'all' && (
                      <th className="text-left p-4 font-semibold text-sm text-slate-700">
                        Empresa
                      </th>
                    )}
                    {activeTab === 'blacklist' && (
                      <>
                        <th className="text-left p-4 font-semibold text-sm text-slate-700">
                          Motivo
                        </th>
                        <th className="text-left p-4 font-semibold text-sm text-slate-700">
                          Bloqueado em
                        </th>
                      </>
                    )}
                    <th className="text-center p-4 font-semibold text-sm text-slate-700">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contatosFiltrados.map((contato: Contact) => (
                    <tr 
                      key={contato.id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            activeTab === 'blacklist'
                              ? 'bg-gradient-to-br from-red-500/20 to-red-500/10'
                              : 'bg-gradient-to-br from-[#BD8F29]/20 to-[#BD8F29]/10'
                          }`}>
                            <span className={`font-semibold ${
                              activeTab === 'blacklist' ? 'text-red-600' : 'text-[#BD8F29]'
                            }`}>
                              {contato.name?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <span className="font-medium text-[#1D2748]">
                            {contato.name || 'Sem nome'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Phone className="w-4 h-4" />
                          <span>{formatPhone(contato.phone)}</span>
                        </div>
                      </td>
                      {activeTab === 'all' && (
                        <td className="p-4">
                          {contato.company ? (
                            <div className="flex items-center gap-2 text-slate-700">
                              <Building2 className="w-4 h-4" />
                              <span>{contato.company}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}
                      {activeTab === 'blacklist' && (
                        <>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                              <span className="font-semibold text-red-600">
                                {contato.blacklistReason || 'Manual'}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-slate-600 text-sm">
                              <Clock className="w-4 h-4" />
                              {formatDate(contato.blacklistedAt)}
                            </div>
                          </td>
                        </>
                      )}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {activeTab === 'blacklist' ? (
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnblock(contato.id)}
                              disabled={unblockingId === contato.id}
                              className="border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white"
                            >
                              {unblockingId === contato.id ? (
                                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Shield className="w-4 h-4 mr-1.5" />
                                  Desbloquear
                                </>
                              )}
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(contato)}
                                className="text-slate-600 hover:text-[#BD8F29]"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBlock(contato)}
                                disabled={blockingId === contato.id}
                                className="text-slate-600 hover:text-red-600"
                                title="Bloquear (adicionar à blacklist)"
                              >
                                {blockingId === contato.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Ban className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(contato)}
                                disabled={deletingId === contato.id}
                                className="text-slate-600 hover:text-red-600"
                              >
                                {deletingId === contato.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginacao: a lista vem de 50 em 50 do servidor */}
            <div className="flex items-center justify-between gap-4 border-t px-6 py-4">
              <p className="text-sm text-slate-500">
                {carregando ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> carregando...
                  </span>
                ) : (
                  <>
                    Mostrando {contatosFiltrados.length} de {total}
                    {searchTerm ? ' resultados' : ' contatos'}
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || carregando}
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-slate-600">
                  {page} / {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPaginas || carregando}
                  onClick={() => setPage((n) => Math.min(totalPaginas, n + 1))}
                >
                  Proxima
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-16 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#BD8F29]/10 to-[#BD8F29]/5 flex items-center justify-center">
                  {activeTab === 'blacklist' ? (
                    <ShieldOff className="w-10 h-10 text-red-600" />
                  ) : (
                    <Users className="w-10 h-10 text-[#BD8F29]" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-[#1D2748] mb-2">
                  {activeTab === 'blacklist' 
                    ? 'Nenhum contato bloqueado'
                    : searchTerm 
                      ? 'Nenhum contato encontrado' 
                      : 'Nenhum contato cadastrado'
                  }
                </h3>
                <p className="text-slate-500 mb-6">
                  {activeTab === 'blacklist'
                    ? 'Contatos que responderem com palavras de bloqueio aparecerão aqui'
                    : searchTerm 
                      ? 'Tente buscar com outros termos'
                      : 'Adicione contatos manualmente ou importe um arquivo CSV'
                  }
                </p>
                {!searchTerm && activeTab === 'all' && (
                  <div className="flex gap-3 justify-center">
                    <Button 
                      onClick={handleImportarCSV}
                      variant="outline"
                      className="border-[#BD8F29] text-[#BD8F29]"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Importar CSV
                    </Button>
                    <Button 
                      onClick={handleNovoContato}
                      className="bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Contato
                    </Button>
                  </div>
                )}
              </div>
              </CardContent>
            </Card>
        )}
      </div>

      {/* Modal de Edição */}
      {editingContact && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeEdit}
          />
          <Card className="relative w-full max-w-md border-0 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-[#BD8F29]/20 to-[#BD8F29]/10">
                    <Edit className="w-5 h-5 text-[#BD8F29]" />
                  </div>
                  <h2 className="text-xl font-bold text-[#1D2748]">Editar Contato</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeEdit}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nome
                  </label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Nome do contato"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Telefone
                  </label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+5541999999999"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Formato: +55 + DDD + número (ex: +5541999999999)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Empresa <span className="text-slate-400">(opcional)</span>
                  </label>
                  <Input
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    placeholder="Empresa"
                  />
                </div>

                {editError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeEdit}
                    disabled={savingEdit}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white"
                  >
                    {savingEdit ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}