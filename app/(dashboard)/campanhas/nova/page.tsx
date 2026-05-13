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

  // Busca instâncias ativas (Baileys conectadas + Cloud API). Necessário pra
  // a UI decidir entre texto livre e template aprovado.
  const instancias = await prisma.whatsAppInstance.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      instanceKey: true,
      provider: true,
      status: true,
      phone: true,
    },
  })

  return <NovaCampanhaClient user={user} contatos={contatos} instancias={instancias} />
}