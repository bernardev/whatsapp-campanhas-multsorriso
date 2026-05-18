// app/campanhas/[id]/dashboard/dashboard-client.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  Info,
} from 'lucide-react'

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
  responded: boolean
}

interface CampaignStats {
  total: number
  pending: number
  sending: number
  sent: number
  delivered: number
  read: number
  failed: number
  responded: number
}

interface CampaignData {
  campaign: {
    id: string
    name: string
    status: string
    createdAt: string
    templateName: string | null
  }
  stats: CampaignStats
  messages: Message[]
}

interface DashboardClientProps {
  campaignId: string
}

const GOLD = '#BD8F29'
const NAVY = '#1D2748'

export default function DashboardClient({ campaignId }: DashboardClientProps) {
  const router = useRouter()
  const [data, setData] = useState<CampaignData | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const eventSource = new EventSource(`/api/campanhas/${campaignId}/stream`)

    eventSource.onopen = () => setConnected(true)
    eventSource.onmessage = (event) => {
      setData(JSON.parse(event.data) as CampaignData)
    }
    eventSource.onerror = () => setConnected(false)

    return () => eventSource.close()
  }, [campaignId])

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: GOLD }}
          />
          <p className="text-slate-600">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  const { campaign, stats, messages } = data

  // Funil cumulativo
  const enviadas = stats.sent + stats.delivered + stats.read
  const entregues = stats.delivered + stats.read
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
  const progresso =
    stats.total > 0
      ? Math.round(((enviadas + stats.failed) / stats.total) * 100)
      : 0
  const emAndamento = stats.pending + stats.sending

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header do sistema */}
      <div className="border-b bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-multsorriso.png"
              alt="MultSorriso"
              width={120}
              height={48}
              className="object-contain cursor-pointer"
              onClick={() => router.push('/campanhas')}
            />
            <button
              onClick={() => router.push('/campanhas')}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#1D2748] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Campanhas
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-slate-500">
              {connected ? 'Ao vivo' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Título da campanha */}
        <div className="mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold" style={{ color: NAVY }}>
              {campaign.name}
            </h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1.5">
            {campaign.templateName && (
              <>
                Template{' '}
                <span className="font-medium text-slate-700">
                  {campaign.templateName}
                </span>{' '}
                ·{' '}
              </>
            )}
            Criada em {formatDateTime(campaign.createdAt)}
          </p>
        </div>

        {/* Funil de KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Kpi label="Total" value={stats.total} hint="contatos" />
          <Kpi
            label="Enviadas"
            value={enviadas}
            hint={`${pct(enviadas, stats.total)}% do total`}
          />
          <Kpi
            label="Entregues"
            value={entregues}
            hint={`${pct(entregues, enviadas)}% das enviadas`}
            tone="positive"
          />
          <Kpi
            label="Lidas"
            value={stats.read}
            hint={`${pct(stats.read, entregues)}% das entregues`}
            tone="positive"
          />
          <Kpi
            label="Responderam"
            value={stats.responded}
            hint={`${pct(stats.responded, enviadas)}% das enviadas`}
            tone="hero"
          />
          <Kpi
            label="Falhas"
            value={stats.failed}
            hint={`${pct(stats.failed, stats.total)}% do total`}
            tone={stats.failed > 0 ? 'negative' : 'neutral'}
          />
        </div>

        {/* Progresso */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold" style={{ color: NAVY }}>
              Progresso do envio
            </span>
            <span className="text-sm font-semibold text-slate-700">
              {progresso}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
            {stats.total > 0 && (
              <>
                <div
                  style={{
                    width: `${(stats.sent / stats.total) * 100}%`,
                    backgroundColor: GOLD,
                  }}
                />
                <div
                  className="bg-emerald-400"
                  style={{ width: `${(stats.delivered / stats.total) * 100}%` }}
                />
                <div
                  className="bg-emerald-600"
                  style={{ width: `${(stats.read / stats.total) * 100}%` }}
                />
                <div
                  className="bg-red-500"
                  style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                />
              </>
            )}
          </div>
          {emAndamento > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              {stats.pending} na fila · {stats.sending} enviando agora
            </p>
          )}
        </div>

        {/* Painel de falhas */}
        {stats.failed > 0 && (
          <div className="bg-white rounded-xl border border-red-200 mb-6 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-800">
                {stats.failed} {stats.failed === 1 ? 'falha' : 'falhas'} — confira o motivo
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {messages
                .filter((m) => m.status === 'FAILED')
                .map((m) => (
                  <div
                    key={m.id}
                    className="px-5 py-3 flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {m.name || 'Sem nome'}
                      </p>
                      <p className="text-xs text-slate-500">{m.phone}</p>
                    </div>
                    <p className="text-xs text-red-700 text-right max-w-[60%] break-words">
                      {m.errorMsg || 'Motivo não informado'}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Tabela de contatos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Contato', 'Telefone', 'Status', 'Enviada', 'Entregue', 'Lida', 'Respondeu'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {messages.map((message) => (
                  <tr key={message.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">
                      {message.name || '-'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {message.phone}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={message.status} />
                      {message.status === 'FAILED' && message.errorMsg && (
                        <p className="text-xs text-red-600 mt-1 max-w-xs break-words">
                          {message.errorMsg}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {message.sentAt ? formatTime(message.sentAt) : '-'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {message.deliveredAt ? formatTime(message.deliveredAt) : '-'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {message.readAt ? formatTime(message.readAt) : '-'}
                    </td>
                    <td className="px-5 py-3">
                      {message.responded ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <MessageCircle className="w-3.5 h-3.5" />
                          Respondeu
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nota sobre leitura */}
        <p className="flex items-start gap-1.5 text-xs text-slate-400 mt-4">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          &quot;Lidas&quot; conta apenas destinatários com confirmação de leitura
          ativada no WhatsApp — o número real pode ser maior.
        </p>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: number
  hint: string
  tone?: 'neutral' | 'positive' | 'negative' | 'hero'
}) {
  const styles: Record<string, string> = {
    neutral: 'border-slate-200 bg-white',
    positive: 'border-emerald-200 bg-emerald-50/40',
    negative: 'border-red-200 bg-red-50/40',
    hero: 'border-[#BD8F29] bg-[#BD8F29]/5',
  }
  const valueColor: Record<string, string> = {
    neutral: NAVY,
    positive: '#047857',
    negative: '#b91c1c',
    hero: GOLD,
  }
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${styles[tone]}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className="text-3xl font-bold mt-1"
        style={{ color: valueColor[tone] }}
      >
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-slate-100 text-slate-700',
    SENDING: 'bg-amber-100 text-amber-800',
    SENT: 'bg-sky-100 text-sky-800',
    DELIVERED: 'bg-emerald-100 text-emerald-800',
    READ: 'bg-emerald-200 text-emerald-900',
    FAILED: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    PENDING: 'Na fila',
    SENDING: 'Enviando',
    SENT: 'Enviada',
    DELIVERED: 'Entregue',
    READ: 'Lida',
    FAILED: 'Falhou',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        styles[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {status === 'READ' && <CheckCircle2 className="w-3 h-3" />}
      {labels[status] || status}
    </span>
  )
}

function CampaignStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
    RUNNING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    COMPLETED: 'bg-blue-50 text-blue-700 border-blue-200',
    SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
    PAUSED: 'bg-orange-50 text-orange-700 border-orange-200',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  }
  const labels: Record<string, string> = {
    DRAFT: 'Rascunho',
    RUNNING: 'Em execução',
    COMPLETED: 'Concluída',
    SCHEDULED: 'Agendada',
    PAUSED: 'Pausada',
    CANCELLED: 'Cancelada',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
        styles[status] || 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {labels[status] || status}
    </span>
  )
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
