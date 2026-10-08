// app/(dashboard)/contatos/page.tsx
import { redirect } from 'next/navigation'
import { getVerifiedUser as getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ContatosClient from './contatos-client'

const PAGE_SIZE = 50

export default async function ContatosPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // Só a primeira página. A busca, a troca de aba e as páginas seguintes vão
  // por GET /api/contatos — antes isto trazia os 7.000+ contatos de uma vez.
  const [contatos, ativos, blacklist] = await Promise.all([
    prisma.contact.findMany({
      where: { blacklisted: false },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      select: {
        id: true,
        phone: true,
        name: true,
        company: true,
        blacklisted: true,
        blacklistedAt: true,
        blacklistReason: true,
        blacklistedBy: true,
        createdAt: true,
      },
    }),
    prisma.contact.count({ where: { blacklisted: false } }),
    prisma.contact.count({ where: { blacklisted: true } }),
  ])

  return (
    <ContatosClient
      user={user}
      contatos={contatos}
      counts={{ ativos, blacklist, todos: ativos + blacklist }}
      totalInicial={ativos}
      pageSize={PAGE_SIZE}
    />
  )
}
