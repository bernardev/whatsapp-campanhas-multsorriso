// lib/auth.ts
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'seu-secret-super-seguro'
)

type UserRole = 'ADMIN' | 'USER'

export async function getUser() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token.value, SECRET)

    return {
      id: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: (payload.role as UserRole) || 'USER'
    }
  } catch {
    return null
  }
}

export async function requireAuth() {
  const user = await getUser()

  if (!user) {
    throw new Error('Não autorizado')
  }

  return user
}

export async function requireAdmin() {
  const user = await requireAuth()

  if (user.role !== 'ADMIN') {
    throw new Error('Acesso restrito a administradores')
  }

  return user
}
