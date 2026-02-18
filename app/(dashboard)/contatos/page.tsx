// app/(dashboard)/contatos/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ContatosClient from './contatos-client'

export default async function ContatosPage() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  const contatos = await prisma.contact.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      phone: true,
      name: true,
      company: true,
      blacklisted: true,
      blacklistedAt: true,
      blacklistReason: true,
      blacklistedBy: true,
      createdAt: true
    }
  })

  return <ContatosClient user={user} contatos={contatos} />
}