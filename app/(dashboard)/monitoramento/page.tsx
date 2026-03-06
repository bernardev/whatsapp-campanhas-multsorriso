// app/(dashboard)/monitoramento/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import MonitoramentoClient from './monitoramento-client'

export default async function MonitoramentoPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'ADMIN') {
    redirect('/campanhas')
  }

  return <MonitoramentoClient user={user} />
}
