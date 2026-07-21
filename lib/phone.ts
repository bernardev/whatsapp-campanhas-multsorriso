// lib/phone.ts
// Normalização de telefone/remoteJid do WhatsApp.
// Números BR chegam em vários formatos (com/sem "+", com/sem o 9º dígito), o que
// fragmentava a mesma pessoa em várias "conversas". Aqui unificamos por uma
// chave canônica e sabemos gerar todas as variantes para casar no banco.

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

// Chave canônica de um remoteJid (ou telefone). Grupos (@g.us) não são
// normalizados. Números BR (55 + DDD + número) vão para a forma de 13 dígitos
// (com o 9).
export function canonicalKey(remoteJid: string): string {
  if (remoteJid.includes('@g.us')) return remoteJid
  const d = onlyDigits(remoteJid.replace('@s.whatsapp.net', ''))
  if (d.length === 12 && d.startsWith('55')) return d.slice(0, 4) + '9' + d.slice(4)
  return d
}

// Todos os remoteJids possíveis (variantes de formato) de um número, para casar
// mensagens no banco. Grupos retornam só o próprio jid.
export function remoteJidVariants(remoteJid: string): string[] {
  if (remoteJid.includes('@g.us')) return [remoteJid]
  const canon = canonicalKey(remoteJid)
  const digits = new Set<string>([canon])
  if (canon.length === 13 && canon[4] === '9') {
    digits.add(canon.slice(0, 4) + canon.slice(5)) // forma sem o 9
  }
  const out: string[] = []
  for (const d of digits) {
    out.push(`${d}@s.whatsapp.net`)
    out.push(`+${d}@s.whatsapp.net`)
  }
  return out
}

// Extrai o nome do template/campanha de uma mensagem ENVIADA.
// Formatos observados: "[template:NOME] ..." e "▶️NOME◀️".
export function parseCampaign(text: string | null | undefined): string | null {
  if (!text) return null
  let m = text.match(/\[template:([a-z0-9_]+)\]/i)
  if (m) return m[1]
  m = text.match(/[▶►]️?\s*([a-z0-9_]+)\s*[◀◄]/i)
  if (m) return m[1]
  return null
}

// Nome amigável da campanha para a etiqueta (troca "_" por espaço).
export function prettyCampaign(name: string): string {
  return name.replace(/_/g, ' ')
}
