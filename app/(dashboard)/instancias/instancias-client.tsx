// app/(dashboard)/instancias/instancias-client.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import { 
  Smartphone,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'

interface WhatsAppInstance {
  id: string
  name: string
  instanceKey: string
  phone: string | null
  status: string
  qrCode: string | null
  createdAt: Date
}

interface InstanciasClientProps {
  user: {
    id: string
    name: string
    email: string
  }
  instancias: WhatsAppInstance[]
}

export default function InstanciasClient({ user, instancias: initialInstancias }: InstanciasClientProps) {
  const router = useRouter()
  const [instancias, setInstancias] = useState<WhatsAppInstance[]>(initialInstancias)
  const [showNewModal, setShowNewModal] = useState<boolean>(false)
  const [newInstanceName, setNewInstanceName] = useState<string>('')
  const [creating, setCreating] = useState<boolean>(false)
  const [loadingQR, setLoadingQR] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      refreshStatuses()
    }, 10000)

    return () => clearInterval(interval)
  }, [instancias])

  const refreshStatuses = async (): Promise<void> => {
    try {
      const promises = instancias.map(async (inst) => {
        const response = await fetch(`/api/instancias/${inst.id}`)
        const data = await response.json()
        return data.instance
      })

      const updated = await Promise.all(promises)
      setInstancias(updated)
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
    }
  }

  const handleLogout = async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleCreate = async (): Promise<void> => {
    if (!newInstanceName.trim()) {
      alert('Digite um nome para a instância')
      return
    }

    try {
      setCreating(true)

      const response = await fetch('/api/instancias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newInstanceName })
      })

      if (!response.ok) throw new Error('Erro ao criar instância')

      const data = await response.json()
      setInstancias([data.instance, ...instancias])
      setNewInstanceName('')
      setShowNewModal(false)
      
      router.refresh()
    } catch (error) {
      console.error('Erro ao criar:', error)
      alert('Erro ao criar instância')
    } finally {
      setCreating(false)
    }
  }

  const handleRefreshQR = async (id: string): Promise<void> => {
    try {
      setLoadingQR(id)

      const response = await fetch(`/api/instancias/${id}/qrcode`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Erro ao gerar QR Code')

      const data = await response.json()
      
      setInstancias(instancias.map(inst => 
        inst.id === id ? { ...inst, qrCode: data.qrCode } : inst
      ))
    } catch (error) {
      console.error('Erro ao gerar QR:', error)
      alert('Erro ao gerar QR Code')
    } finally {
      setLoadingQR(null)
    }
  }

  const handleDelete = async (id: string, name: string): Promise<void> => {
    if (!confirm(`Deseja deletar a instância "${name}"?`)) return

    try {
      setDeleting(id)

      const response = await fetch(`/api/instancias/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erro ao deletar')

      setInstancias(instancias.filter(inst => inst.id !== id))
      
      router.refresh()
    } catch (error) {
      console.error('Erro ao deletar:', error)
      alert('Erro ao deletar instância')
    } finally {
      setDeleting(null)
    }
  }

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
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Smartphone className="w-8 h-8 text-[#BD8F29]" />
            <h1 className="text-4xl font-bold text-[#1D2748]">
              Instâncias WhatsApp
            </h1>
          </div>
          <p className="text-slate-600 text-lg">
            Gerencie suas conexões do WhatsApp
          </p>
        </div>

        <div className="mb-6">
          <Button 
            onClick={() => setShowNewModal(true)}
            className="bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Instância
          </Button>
        </div>

        {/* Lista de Instâncias */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instancias.map((instance) => (
            <Card key={instance.id} className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-[#1D2748]">{instance.name}</span>
                  {instance.status === 'connected' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Status</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    instance.status === 'connected'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>

                {instance.phone && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Número</p>
                    <p className="font-semibold text-[#1D2748]">{instance.phone}</p>
                  </div>
                )}

                {instance.status !== 'connected' && (
                  <div className="space-y-2">
                    {instance.qrCode ? (
                      <div className="border border-slate-200 rounded-lg p-4 bg-white">
                        <img 
                          src={instance.qrCode} 
                          alt="QR Code"
                          className="w-full h-auto"
                        />
                        <p className="text-xs text-center text-slate-500 mt-2">
                          Escaneie com seu WhatsApp
                        </p>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleRefreshQR(instance.id)}
                        disabled={loadingQR === instance.id}
                        variant="outline"
                        className="w-full"
                      >
                        {loadingQR === instance.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Gerar QR Code
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleRefreshQR(instance.id)}
                    disabled={loadingQR === instance.id}
                    variant="outline"
                    className="flex-1"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(instance.id, instance.name)}
                    disabled={deleting === instance.id}
                    variant="outline"
                    className="flex-1 border-red-500 text-red-600 hover:bg-red-500 hover:text-white"
                    size="sm"
                  >
                    {deleting === instance.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {instancias.length === 0 && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-16 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#BD8F29]/10 to-[#BD8F29]/5 flex items-center justify-center">
                  <Smartphone className="w-10 h-10 text-[#BD8F29]" />
                </div>
                <h3 className="text-xl font-bold text-[#1D2748] mb-2">
                  Nenhuma instância conectada
                </h3>
                <p className="text-slate-500 mb-6">
                  Crie uma instância para começar a enviar mensagens
                </p>
                <Button 
                  onClick={() => setShowNewModal(true)}
                  className="bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Instância
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal Nova Instância */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-[#1D2748]">Nova Instância</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Instância</Label>
                <Input
                  id="name"
                  placeholder="Ex: WhatsApp Principal"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewModal(false)
                    setNewInstanceName('')
                  }}
                  className="flex-1"
                  disabled={creating}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !newInstanceName.trim()}
                  className="flex-1 bg-[#BD8F29] hover:bg-[#BD8F29]/90"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}