'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  Phone,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  Bell,
  ArrowLeft,
} from 'lucide-react'

const TZ = 'America/Sao_Paulo'

type AppointmentStatus = 'AGENDADO' | 'CONFIRMADO' | 'CANCELADO' | 'REALIZADO' | 'FALTOU'

interface Contact {
  id: string
  name: string | null
  phone: string
}

interface Appointment {
  id: string
  scheduledFor: string
  professional: string | null
  notes: string | null
  status: AppointmentStatus
  lembreteVesperaEnviadoEm: string | null
  lembreteDiaEnviadoEm: string | null
  contact: Contact
}

interface AgendaClientProps {
  user: { id: string; name: string; email: string; role: 'ADMIN' | 'USER' }
  contatos: Contact[]
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const STATUS_INFO: Record<AppointmentStatus, { label: string; cls: string }> = {
  AGENDADO: { label: 'Agendado', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  CONFIRMADO: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELADO: { label: 'Cancelado', cls: 'bg-red-50 text-red-700 border-red-200' },
  REALIZADO: { label: 'Realizado', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  FALTOU: { label: 'Faltou', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
}

// "YYYY-MM-DD" no fuso de SP a partir de uma data
function spDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}
function spTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export default function AgendaClient({ user, contatos }: AgendaClientProps) {
  const router = useRouter()
  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth()) // 0-based
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Modal de agendamento
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ contactId: '', scheduledFor: '', professional: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [actingId, setActingId] = useState<string | null>(null)
  const [testando, setTestando] = useState(false)

  const hojeKey = spDateKey(now)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      // Intervalo amplo cobrindo o mês visível (com folga nas bordas)
      const from = new Date(ano, mes, 1, 0, 0, 0)
      const to = new Date(ano, mes + 1, 7, 23, 59, 59)
      const res = await fetch(
        `/api/agenda?from=${from.toISOString()}&to=${to.toISOString()}`
      )
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [ano, mes])

  useEffect(() => { carregar() }, [carregar])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  // Agrupa agendamentos por dia (chave SP)
  const porDia = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    const key = spDateKey(new Date(a.scheduledFor))
    ;(acc[key] = acc[key] || []).push(a)
    return acc
  }, {})

  // Monta a grade do mês (começando no domingo)
  const primeiroDia = new Date(ano, mes, 1)
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const offset = primeiroDia.getDay() // 0=Dom
  const celulas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]
  while (celulas.length % 7 !== 0) celulas.push(null)

  const dayKey = (dia: number) =>
    `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

  const mudarMes = (delta: number) => {
    const novo = new Date(ano, mes + delta, 1)
    setAno(novo.getFullYear())
    setMes(novo.getMonth())
    setSelectedDay(null)
  }

  const abrirAgendamento = (diaKey?: string) => {
    setFormError(null)
    setForm({
      contactId: '',
      scheduledFor: diaKey ? `${diaKey}T09:00` : '',
      professional: '',
      notes: '',
    })
    setShowForm(true)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao agendar')
      setShowForm(false)
      await carregar()
      setSelectedDay(spDateKey(new Date(`${form.scheduledFor}:00-03:00`)))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao agendar')
    } finally {
      setSaving(false)
    }
  }

  const mudarStatus = async (id: string, status: AppointmentStatus) => {
    setActingId(id)
    try {
      await fetch(`/api/agenda/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await carregar()
    } finally {
      setActingId(null)
    }
  }

  const excluir = async (id: string) => {
    if (!confirm('Excluir este agendamento?')) return
    setActingId(id)
    try {
      await fetch(`/api/agenda/${id}`, { method: 'DELETE' })
      await carregar()
    } finally {
      setActingId(null)
    }
  }

  const testarLembretes = async () => {
    if (!confirm('Disparar os lembretes agora (consultas de hoje e amanhã)?\n\nIsso envia mensagens reais via WhatsApp.')) return
    setTestando(true)
    try {
      const res = await fetch('/api/agenda/lembretes', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      const r = data.result
      alert(
        `Lembretes disparados!\n\nVéspera (amanhã): ${r.vespera.enviados} enviados, ${r.vespera.falhas} falhas\nNo dia (hoje): ${r.dia.enviados} enviados, ${r.dia.falhas} falhas`
      )
      await carregar()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao disparar lembretes')
    } finally {
      setTestando(false)
    }
  }

  const diaSelecionadoAppts = selectedDay ? (porDia[selectedDay] || []) : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-multsorriso.png" alt="MultSorriso" width={140} height={56}
              className="object-contain cursor-pointer"
              onClick={() => router.push('/campanhas')}
            />
            <Button
              variant="ghost" size="sm"
              onClick={() => router.push('/campanhas')}
              className="text-slate-600 hover:text-[#1D2748]"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-[#1D2748]">{user.name}</span>
              <span className="text-xs text-slate-500">{user.email}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}
              className="border-slate-200 hover:bg-slate-50 text-slate-700">
              Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Título + ações */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <CalendarIcon className="w-8 h-8 text-[#BD8F29]" />
              <h1 className="text-4xl font-bold text-[#1D2748]">Agenda</h1>
            </div>
            <p className="text-slate-600 text-lg">Agendamentos de avaliação e lembretes automáticos</p>
          </div>
          <div className="flex gap-3">
            {user.role === 'ADMIN' && (
              <Button variant="outline" onClick={testarLembretes} disabled={testando}
                className="border-[#BD8F29] text-[#BD8F29] hover:bg-[#BD8F29]/10">
                {testando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
                Testar lembretes
              </Button>
            )}
            <Button onClick={() => abrirAgendamento(selectedDay || undefined)}
              className="bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white shadow-lg">
              <Plus className="w-4 h-4 mr-2" /> Agendar avaliação
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendário */}
          <Card className="lg:col-span-2 border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#1D2748]">
                  {MESES[mes]} {ano}
                </h2>
                <div className="flex items-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  <Button variant="outline" size="icon" onClick={() => mudarMes(-1)} className="border-slate-200">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setAno(now.getFullYear()); setMes(now.getMonth()) }}
                    className="border-slate-200">Hoje</Button>
                  <Button variant="outline" size="icon" onClick={() => mudarMes(1)} className="border-slate-200">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {celulas.map((dia, idx) => {
                  if (dia === null) return <div key={idx} />
                  const key = dayKey(dia)
                  const appts = porDia[key] || []
                  const ativos = appts.filter((a) => a.status !== 'CANCELADO')
                  const isHoje = key === hojeKey
                  const isSel = key === selectedDay
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDay(key)}
                      className={`min-h-[68px] p-2 rounded-lg border text-left transition-all hover:border-[#BD8F29] ${
                        isSel ? 'border-[#BD8F29] bg-[#BD8F29]/5 ring-1 ring-[#BD8F29]'
                          : isHoje ? 'border-[#1D2748]/30 bg-[#1D2748]/5' : 'border-slate-100'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${isHoje ? 'text-[#BD8F29]' : 'text-slate-700'}`}>{dia}</span>
                      {ativos.length > 0 && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#BD8F29]/15 text-[#BD8F29]">
                            {ativos.length} {ativos.length === 1 ? 'aval.' : 'avals.'}
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Painel do dia */}
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#1D2748]">
                  {selectedDay
                    ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
                    : 'Selecione um dia'}
                </h3>
                {selectedDay && (
                  <Button size="sm" variant="ghost" onClick={() => abrirAgendamento(selectedDay)}
                    className="text-[#BD8F29] hover:bg-[#BD8F29]/10">
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {!selectedDay ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  Clique em um dia no calendário para ver os agendamentos.
                </p>
              ) : diaSelecionadoAppts.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Nenhuma avaliação neste dia.</p>
                  <Button size="sm" onClick={() => abrirAgendamento(selectedDay)}
                    className="mt-3 bg-[#BD8F29] hover:bg-[#BD8F29]/90 text-white">
                    <Plus className="w-4 h-4 mr-1.5" /> Agendar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {diaSelecionadoAppts
                    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
                    .map((a) => (
                      <div key={a.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#BD8F29]" />
                            <span className="font-bold text-[#1D2748]">{spTime(a.scheduledFor)}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_INFO[a.status].cls}`}>
                            {STATUS_INFO[a.status].label}
                          </span>
                        </div>
                        <p className="font-medium text-slate-800 text-sm">{a.contact.name || 'Sem nome'}</p>
                        <p className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                          <Phone className="w-3 h-3" /> {a.contact.phone}
                        </p>
                        {a.professional && (
                          <p className="text-xs text-slate-500 mb-2">👨‍⚕️ {a.professional}</p>
                        )}
                        {(a.lembreteVesperaEnviadoEm || a.lembreteDiaEnviadoEm) && (
                          <p className="text-[10px] text-emerald-600 mb-2">
                            ✓ Lembrete enviado
                            {a.lembreteVesperaEnviadoEm ? ' (véspera)' : ''}
                            {a.lembreteDiaEnviadoEm ? ' (dia)' : ''}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {a.status !== 'CONFIRMADO' && a.status !== 'CANCELADO' && (
                            <Button size="sm" variant="outline" disabled={actingId === a.id}
                              onClick={() => mudarStatus(a.id, 'CONFIRMADO')}
                              className="h-7 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white">
                              <CheckCircle className="w-3 h-3 mr-1" /> Confirmar
                            </Button>
                          )}
                          {a.status !== 'CANCELADO' && (
                            <Button size="sm" variant="outline" disabled={actingId === a.id}
                              onClick={() => mudarStatus(a.id, 'CANCELADO')}
                              className="h-7 text-xs border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white">
                              <XCircle className="w-3 h-3 mr-1" /> Cancelar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" disabled={actingId === a.id}
                            onClick={() => excluir(a.id)}
                            className="h-7 text-xs text-slate-500 hover:text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de agendamento */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setShowForm(false)} />
          <Card className="relative w-full max-w-md border-0 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-[#BD8F29]/20 to-[#BD8F29]/10">
                    <CalendarIcon className="w-5 h-5 text-[#BD8F29]" />
                  </div>
                  <h2 className="text-xl font-bold text-[#1D2748]">Agendar avaliação</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={() => !saving && setShowForm(false)}
                  className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={salvar} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Paciente</label>
                  <select
                    value={form.contactId}
                    onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                    required
                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#BD8F29]/40"
                  >
                    <option value="">Selecione um contato...</option>
                    {contatos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {(c.name || 'Sem nome')} — {c.phone}
                      </option>
                    ))}
                  </select>
                  {contatos.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Nenhum contato cadastrado. Cadastre em Contatos primeiro.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Data e horário</label>
                  <Input type="datetime-local" value={form.scheduledFor}
                    onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Profissional <span className="text-slate-400">(opcional)</span>
                  </label>
                  <Input value={form.professional} placeholder="Ex: Dra. Ana"
                    onChange={(e) => setForm({ ...form, professional: e.target.value })} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Observação <span className="text-slate-400">(opcional)</span>
                  </label>
                  <Input value={form.notes} placeholder="Anotações internas"
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>

                {formError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {formError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={saving} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}
                    className="flex-1 bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white">
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Agendar'}
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
