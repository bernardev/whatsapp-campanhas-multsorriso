// app/(dashboard)/campanhas/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import DashboardClient from './dashboard-client'

const PAGE_SIZE = 10

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  // Verifica se está logado
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // Paginação: ?page=N (1-based). Sanitiza valores inválidos para 1.
  const { page: pageParam } = await searchParams
  const parsedPage = parseInt(pageParam || '1', 10)
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage

  // Busca estatísticas reais
  const [
    totalCampanhas,
    campanhasAtivas,
    totalContatos,
    totalMensagens,
    mensagensEnviadas
  ] = await Promise.all([
    prisma.campaign.count({ where: { userId: user.id } }),
    prisma.campaign.count({ 
      where: { 
        userId: user.id,
        status: 'RUNNING'
      }
    }),
    prisma.contact.count(),
    prisma.message.count(),
    prisma.message.count({ where: { status: { in: ['SENT', 'DELIVERED', 'READ'] } } })
  ])

  const taxaEntrega = totalMensagens > 0 
    ? ((mensagensEnviadas / totalMensagens) * 100).toFixed(1)
    : '0.0'

  // Total de campanhas para calcular o número de páginas
  const totalCampanhasUsuario = totalCampanhas
  const totalPages = Math.max(1, Math.ceil(totalCampanhasUsuario / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  // Busca campanhas do usuário (página atual)
  const campanhas = await prisma.campaign.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: {
          messages: true,
          contacts: true
        }
      },
      messages: {
        select: {
          status: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE
  })

  const stats = {
    totalCampanhas,
    campanhasAtivas,
    totalContatos,
    mensagensEnviadas: totalMensagens,
    taxaEntrega: parseFloat(taxaEntrega)
  }

  const pagination = {
    currentPage: safePage,
    totalPages,
    totalItems: totalCampanhasUsuario,
    pageSize: PAGE_SIZE,
  }

  return (
    <DashboardClient
      user={user}
      stats={stats}
      campanhas={campanhas}
      pagination={pagination}
    />
  )
}