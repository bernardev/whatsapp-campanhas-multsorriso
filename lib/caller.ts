// lib/caller.ts
// Quem está chamando a API:
//   - usuário do painel  → cookie "auth-token" (JWT, via getUser())
//   - app externo (ex.: Vitória Dental) → "Authorization: Bearer <token de serviço>"
//
// Use SOMENTE nas rotas liberadas para app externo (hoje: 4 rotas de conversas).
// getUser()/requireAuth()/requireAdmin() de lib/auth.ts continuam SÓ-COOKIE de
// propósito: são usados em ~30 rotas/páginas (inclusive /api/admin/*) e não
// podem passar a aceitar token de serviço por tabela.
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getVerifiedUser } from '@/lib/auth'
import {
  hashServiceToken,
  SERVICE_TOKEN_PREFIX,
  type ServiceScope,
} from '@/lib/service-token'

export type Caller =
  | {
      kind: 'user'
      id: string
      name: string
      email: string
      role: 'ADMIN' | 'USER'
      // null = sem restrição de instância (comportamento atual do painel).
      // Quando o F5 (escopo por instância) existir para usuário, preencher aqui.
      instanceIds: null
    }
  | {
      kind: 'service'
      id: string // ServiceToken.id
      name: string // ServiceToken.name (ex.: "Vitória Dental")
      scopes: string[]
      // SEMPRE restrito. [] = nenhuma instância (fail-closed, nunca "todas").
      instanceIds: string[]
    }

// Atualiza lastUsedAt no máximo 1x a cada 5 min por token (evita 1 UPDATE por request).
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000

type BearerResult =
  | { status: 'absent' }
  | { status: 'invalid' }
  | { status: 'ok'; caller: Caller }

async function readServiceBearer(): Promise<BearerResult> {
  const h = await headers()
  const auth = h.get('authorization')
  if (!auth) return { status: 'absent' }

  const m = /^Bearer\s+(\S+)\s*$/i.exec(auth)
  if (!m) return { status: 'invalid' }
  const token = m[1]

  // JWT de usuário (ou qualquer outra coisa) mandado como Bearer: recusa sem ir ao banco.
  if (!token.startsWith(SERVICE_TOKEN_PREFIX) || token.length < 40) {
    return { status: 'invalid' }
  }

  // Busca pelo HASH (o valor em claro nunca é comparado nem armazenado).
  const row = await prisma.serviceToken.findUnique({
    where: { tokenHash: hashServiceToken(token) },
  })
  if (!row || !row.active) return { status: 'invalid' }

  const now = Date.now()
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    try {
      await prisma.serviceToken.update({
        where: { id: row.id },
        data: { lastUsedAt: new Date(now) },
      })
    } catch (e) {
      console.error('[ServiceToken] Falha ao atualizar lastUsedAt:', e)
    }
  }

  return {
    status: 'ok',
    caller: {
      kind: 'service',
      id: row.id,
      name: row.name,
      scopes: row.scopes,
      instanceIds: row.instanceIds,
    },
  }
}

export async function getCaller(): Promise<Caller | null> {
  const bearer = await readServiceBearer()
  if (bearer.status === 'ok') return bearer.caller
  // Mandou Authorization mas é inválido/revogado → 401. NÃO cai para o cookie.
  if (bearer.status === 'invalid') return null

  // F4: revalida no banco (role atual; usuário excluído perde o acesso na hora).
  // Erro de banco propaga: as rotas chamam authorize() dentro do try (vira 500).
  const user = await getVerifiedUser()
  if (!user) return null
  return { kind: 'user', ...user, instanceIds: null }
}

export function hasScope(caller: Caller, scope: ServiceScope): boolean {
  // Usuário logado no painel mantém o acesso de hoje às rotas de conversas.
  if (caller.kind === 'user') return true
  return caller.scopes.includes(scope)
}

export type AuthorizeResult =
  | { ok: true; caller: Caller }
  | { ok: false; response: NextResponse }

// 401 = não identificado (sem credencial / token inválido / revogado)
// 403 = identificado, mas o token não tem o escopo exigido
export async function authorize(scope: ServiceScope): Promise<AuthorizeResult> {
  const caller = await getCaller()
  if (!caller) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    }
  }
  if (!hasScope(caller, scope)) {
    console.warn(`[ServiceToken] ${caller.name} (${caller.id}) sem escopo ${scope}`)
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Escopo insuficiente', required: scope },
        { status: 403 }
      ),
    }
  }
  return { ok: true, caller }
}

// Filtro Prisma por instância para ConversationMessage:
//   usuário do painel → {} (sem filtro)   |   serviço → { instanceId: { in: [...] } }
export function instanceWhere(caller: Caller): { instanceId?: { in: string[] } } {
  return caller.instanceIds === null ? {} : { instanceId: { in: caller.instanceIds } }
}

// O chamador pode agir sobre esta conversa? (existe ao menos 1 mensagem dela
// numa instância permitida). Usuário do painel: sempre true (comportamento atual).
export async function canAccessConversation(
  caller: Caller,
  remoteJids: string[]
): Promise<boolean> {
  if (caller.instanceIds === null) return true
  if (caller.instanceIds.length === 0) return false
  const hit = await prisma.conversationMessage.findFirst({
    where: { remoteJid: { in: remoteJids }, instanceId: { in: caller.instanceIds } },
    select: { id: true },
  })
  return hit !== null
}
