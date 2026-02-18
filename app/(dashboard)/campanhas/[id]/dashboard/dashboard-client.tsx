// app/campanhas/[id]/dashboard/dashboard-client.tsx
'use client'

import { useEffect, useState } from 'react'

interface Message {
  id: string
  phone: string
  name: string | null
  status: string
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  errorMsg: string | null
  createdAt: Date
}

interface CampaignStats {
  total: number
  pending: number
  sending: number
  sent: number
  delivered: number
  read: number
  failed: number
}

interface CampaignData {
  campaign: {
    id: string
    name: string
    status: string
  }
  stats: CampaignStats
  messages: Message[]
}

interface DashboardClientProps {
  campaignId: string
}

export default function DashboardClient({ campaignId }: DashboardClientProps) {
  const [data, setData] = useState<CampaignData | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const eventSource = new EventSource(`/api/campanhas/${campaignId}/stream`)

    eventSource.onopen = () => {
      setConnected(true)
      console.log('✅ Conectado ao stream')
    }

    eventSource.onmessage = (event) => {
      const newData = JSON.parse(event.data) as CampaignData
      setData(newData)
    }

    eventSource.onerror = (error) => {
      setConnected(false)
      console.error('❌ Erro no stream:', error)
    }

    return () => {
      eventSource.close()
    }
  }, [campaignId])

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  const { campaign, stats, messages } = data

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{campaign.name}</h1>
            <p className="text-gray-600 mt-1">
              Status: <span className="font-semibold">{campaign.status}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className="text-sm text-gray-600">
              {connected ? 'Ao vivo' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard label="Total" value={stats.total} color="bg-gray-500" />
          <StatCard label="Pendentes" value={stats.pending} color="bg-yellow-500" />
          <StatCard label="Enviando" value={stats.sending} color="bg-blue-500" />
          <StatCard label="Enviadas" value={stats.sent} color="bg-indigo-500" />
          <StatCard label="Entregues" value={stats.delivered} color="bg-purple-500" />
          <StatCard label="Lidas" value={stats.read} color="bg-green-500" />
          <StatCard label="Falhas" value={stats.failed} color="bg-red-500" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progresso</span>
            <span className="text-sm font-medium text-gray-700">
              {stats.total > 0 
                ? Math.round(((stats.sent + stats.delivered + stats.read + stats.failed) / stats.total) * 100)
                : 0}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div className="h-full flex">
              {stats.total > 0 && (
                <>
                  <div
                    className="bg-indigo-500"
                    style={{ width: `${(stats.sent / stats.total) * 100}%` }}
                  ></div>
                  <div
                    className="bg-purple-500"
                    style={{ width: `${(stats.delivered / stats.total) * 100}%` }}
                  ></div>
                  <div
                    className="bg-green-500"
                    style={{ width: `${(stats.read / stats.total) * 100}%` }}
                  ></div>
                  <div
                    className="bg-red-500"
                    style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                  ></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Enviada
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entregue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lida
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {messages.map((message) => (
                  <tr key={message.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {message.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {message.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={message.status} errorMsg={message.errorMsg} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {message.sentAt ? formatTime(message.sentAt) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {message.deliveredAt ? formatTime(message.deliveredAt) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {message.readAt ? formatTime(message.readAt) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center mb-3`}>
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
  )
}

function StatusBadge({ status, errorMsg }: { status: string; errorMsg: string | null }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    SENDING: 'bg-blue-100 text-blue-800',
    SENT: 'bg-indigo-100 text-indigo-800',
    DELIVERED: 'bg-purple-100 text-purple-800',
    READ: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800'
  }

  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    SENDING: 'Enviando',
    SENT: 'Enviada',
    DELIVERED: 'Entregue',
    READ: 'Lida',
    FAILED: 'Falhou'
  }

  return (
    <span
      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status]}`}
      title={errorMsg || undefined}
    >
      {labels[status]}
    </span>
  )
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}