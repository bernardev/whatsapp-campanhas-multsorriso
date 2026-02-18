// app/(dashboard)/contatos/importar/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import ImportarContatosClient from './importar-contatos-client'

export default async function ImportarContatosPage() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  return <ImportarContatosClient user={user} />
}