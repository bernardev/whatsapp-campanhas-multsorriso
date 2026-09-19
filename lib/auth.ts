// lib/auth.ts
// Verificação de sessão centralizada (F3 + F4). Use daqui:
//  - getUser()              → leitura do JWT, SEM consultar o banco. Não serve para AUTORIZAR.
//  - getVerifiedUser()      → sessão revalidada no banco (role atual; usuário excluído = null).
//  - authorize()            → helper de rota: devolve 401/403 prontos, revalidado no banco.
//  - getUserIdFromRequest() → Route Handlers que já recebem `request: NextRequest`.
import { jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AUTH_COOKIE, JWT_ALG, JWT_SECRET } from '@/lib/auth-secret'

type UserRole = 'ADMIN' | 'USER'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
}

async function verifyAuthToken(token: string | undefined): Promise<JWTPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: [JWT_ALG] })
    return payload
  } catch {
    return null
  }
}

// Lê só o JWT (vale 7 dias e carrega o role). NÃO consulta o banco: um ADMIN
// rebaixado ou um usuário excluído continuam passando aqui até o token expirar.
// Para AUTORIZAR use authorize() nas rotas e getVerifiedUser() nas páginas.
export async function getUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const payload = await verifyAuthToken(cookieStore.get(AUTH_COOKIE)?.value)

    if (!payload || typeof payload.userId !== 'string') {
      return null
    }

    return {
      id: payload.userId,
      email: payload.email as string,
      name: payload.name as string,
      role: (payload.role as UserRole) || 'USER'
    }
  } catch {
    return null
  }
}

/** Para Route Handlers: lê o cookie do próprio `request` e devolve o userId (ou null). */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const payload = await verifyAuthToken(request.cookies.get(AUTH_COOKIE)?.value)
  return payload && typeof payload.userId === 'string' ? payload.userId : null
}

// Erro de autorização com o status HTTP certo:
// 401 = sem sessão válida, 403 = logado mas sem o papel exigido.
export class AuthError extends Error {
  readonly status: 401 | 403

  constructor(status: 401 | 403, message: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

// Sessão revalidada no banco. Sem esta consulta, um ADMIN rebaixado continua
// ADMIN e um usuário excluído continua acessando até o token expirar (7 dias).
// Lança se o banco falhar (não devolve null nesse caso).
export async function getVerifiedUser(): Promise<AuthUser | null> {
  const session = await getUser()
  if (!session?.id) return null

  return prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, role: true },
  })
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getVerifiedUser()

  if (!user) {
    throw new AuthError(401, 'Não autorizado')
  }

  return user
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()

  if (user.role !== 'ADMIN') {
    throw new AuthError(403, 'Acesso restrito a administradores')
  }

  return user
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse }

// Helper para route handlers. Falta de permissão NÃO lança:
//   const auth = await authorize('ADMIN')   // ou authorize() = qualquer usuário ativo
//   if (!auth.ok) return auth.response
//   const user = auth.user
// Erro de banco é relançado: chame SEMPRE dentro do try da rota (vira 500 em JSON).
export async function authorize(required?: 'ADMIN'): Promise<AuthResult> {
  try {
    const user = required === 'ADMIN' ? await requireAdmin() : await requireAuth()
    return { ok: true, user }
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        response: NextResponse.json({ error: error.message }, { status: error.status }),
      }
    }
    throw error
  }
}
