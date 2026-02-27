// app/(dashboard)/instancias/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import InstanciasClient from './instancias-client'

export default async function InstanciasPage() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

const instancias = await prisma.whatsAppInstance.findMany({
  where: { isActive: true },
  orderBy: { createdAt: 'desc' }
})

  return <InstanciasClient user={user} instancias={instancias} />
}