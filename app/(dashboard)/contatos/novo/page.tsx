// app/(dashboard)/contatos/novo/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import NovoContatoClient from './novo-contato-client'

export default async function NovoContatoPage() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  return <NovoContatoClient user={user} />
}