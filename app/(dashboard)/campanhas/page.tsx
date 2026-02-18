// app/(dashboard)/campanhas/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  // Verifica se está logado
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

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

  // Busca campanhas do usuário
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
    take: 10
  })

  const stats = {
    totalCampanhas,
    campanhasAtivas,
    totalContatos,
    mensagensEnviadas: totalMensagens,
    taxaEntrega: parseFloat(taxaEntrega)
  }

  return <DashboardClient user={user} stats={stats} campanhas={campanhas} />
}