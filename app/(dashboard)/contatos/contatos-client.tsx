// app/(dashboard)/contatos/contatos-client.tsx
'use client'

import { useState } from 'react'
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
  Clock,
  AlertTriangle
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
  }
  contatos: Contact[]
}

type TabType = 'all' | 'blacklist'

export default function ContatosClient({ user, contatos }: ContatosClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [unblockingId, setUnblockingId] = useState<string | null>(null)

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

      router.refresh()
    } catch (error) {
      console.error('Erro ao desbloquear:', error)
      alert('Erro ao desbloquear contato')
    } finally {
      setUnblockingId(null)
    }
  }

  const contatosFiltrados = contatos
    .filter((contato: Contact) => {
      if (activeTab === 'blacklist' && !contato.blacklisted) return false
      if (activeTab === 'all' && contato.blacklisted) return false

      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        return (
          contato.phone.includes(search) ||
          contato.name?.toLowerCase().includes(search) ||
          contato.company?.toLowerCase().includes(search)
        )
      }

      return true
    })

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

  const blacklistedCount = contatos.filter((c: Contact) => c.blacklisted).length
  const activeCount = contatos.filter((c: Contact) => !c.blacklisted).length

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
                    {contatos.length}
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
                                className="text-slate-600 hover:text-[#BD8F29]"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-slate-600 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
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
    </div>
  )
}