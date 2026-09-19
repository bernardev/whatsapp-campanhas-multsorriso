// lib/service-token.ts
// Utilitários PUROS do token de serviço (sem Prisma / sem Next), usados pela
// API (lib/caller.ts) e pelo script scripts/criar-service-token.ts.
// O token em claro NUNCA vai para o banco: só o sha256 (hex, 64 chars).
import { createHash, randomBytes } from 'node:crypto'

export const SERVICE_SCOPES = [
  'conversas:ler',       // GET  /api/conversas  e  GET /api/conversas/[remoteJid]/mensagens
  'conversas:enviar',    // POST /api/conversas/[remoteJid]/enviar
  'conversas:responder', // POST /api/conversas/[remoteJid]/marcar-respondido
] as const

export type ServiceScope = (typeof SERVICE_SCOPES)[number]

// Prefixo fixo: facilita identificar vazamento em logs/repos e rejeitar
// rapidamente (sem ir ao banco) um JWT de usuário mandado como Bearer.
export const SERVICE_TOKEN_PREFIX = 'mss_'

export function isServiceScope(s: string): s is ServiceScope {
  return (SERVICE_SCOPES as readonly string[]).includes(s)
}

// 32 bytes aleatórios (256 bits) em base64url → 43 chars + prefixo.
export function generateServiceToken(): string {
  return SERVICE_TOKEN_PREFIX + randomBytes(32).toString('base64url')
}

export function hashServiceToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
