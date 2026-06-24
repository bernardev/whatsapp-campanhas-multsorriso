// lib/agenda.ts
// Helpers da Agenda/Avaliações: fuso horário, formatação e config dos templates.

export const TZ = 'America/Sao_Paulo'

// Templates aprovados na Meta usados nos lembretes automáticos.
// lembrete_24h        → enviado na VÉSPERA  ({{1}} nome, {{2}} data, {{3}} hora)
// confirmacao_consulta → enviado NO DIA     ({{1}} nome, {{2}} data, {{3}} hora, {{4}} profissional)
export const TEMPLATE_VESPERA = {
  name: 'lembrete_24h',
  language: 'pt_BR',
}
export const TEMPLATE_DIA = {
  name: 'confirmacao_consulta',
  language: 'pt_BR',
}

export const PROFISSIONAL_PADRAO = 'Equipe Mult Sorriso'

// "YYYY-MM-DD" do dia (no fuso de SP) correspondente à data informada.
export function spYmd(date: Date): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

// Limites UTC (início/fim) do dia de calendário em São Paulo.
// Brasil não tem horário de verão desde 2019, então o offset fixo -03:00 é seguro.
export function spDayBoundsUtc(date: Date): { ymd: string; start: Date; end: Date } {
  const ymd = spYmd(date)
  const start = new Date(`${ymd}T00:00:00.000-03:00`)
  const end = new Date(`${ymd}T23:59:59.999-03:00`)
  return { ymd, start, end }
}

// Data formatada pt-BR (DD/MM/AAAA) no fuso de SP.
export function formatDataSP(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

// Hora formatada (HH:MM) no fuso de SP.
export function formatHoraSP(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
