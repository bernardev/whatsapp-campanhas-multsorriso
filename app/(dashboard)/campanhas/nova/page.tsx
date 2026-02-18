// app/(dashboard)/campanhas/nova/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import NovaCampanhaClient from './nova-campanha-client'

export default async function NovaCampanhaPage() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Busca contatos disponíveis
  const contatos = await prisma.contact.findMany({
    where: { blacklisted: false },
    orderBy: { name: 'asc' }
  })

  return <NovaCampanhaClient user={user} contatos={contatos} />
}