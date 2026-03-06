// app/(dashboard)/usuarios/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import UsuariosClient from './usuarios-client'

export default async function UsuariosPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'ADMIN') {
    redirect('/campanhas')
  }

  return <UsuariosClient user={user} />
}
