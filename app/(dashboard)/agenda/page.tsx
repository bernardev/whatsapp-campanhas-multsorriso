// app/(dashboard)/agenda/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AgendaClient from './agenda-client'

export default async function AgendaPage() {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  // Contatos ativos para o seletor do agendamento
  const contatos = await prisma.contact.findMany({
    where: { blacklisted: false },
    select: { id: true, name: true, phone: true },
    orderBy: { name: 'asc' },
  })

  return <AgendaClient user={user} contatos={contatos} />
}
