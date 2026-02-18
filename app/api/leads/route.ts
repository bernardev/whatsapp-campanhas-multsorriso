// app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

interface LeadResponse {
  id: string
  remoteJid: string
  displayName: string
  displayPhone: string
  status: string
  isHot: boolean
  lastMessage: string
  lastMessageAt: Date
  assignedTo: {
    id: string
    name: string
  } | null
  campaign: {
    id: string
    name: string
  } | null
  notes: string | null
  createdAt: Date
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Busca todos os leads
    const leads = await prisma.lead.findMany({
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true
          }
        },
        campaign: {    
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { isHot: 'desc' },        // Leads quentes primeiro
        { status: 'asc' },        // Depois por status (NOVO > EM_ATENDIMENTO > FINALIZADO)
        { updatedAt: 'desc' }     // Por último, mais recentes
      ]
    })

    // Busca última mensagem de cada lead
    const leadsWithMessages: LeadResponse[] = await Promise.all(
      leads.map(async (lead) => {
        const lastMessage = await prisma.conversationMessage.findFirst({
          where: { remoteJid: lead.remoteJid },
          orderBy: { timestamp: 'desc' }
        })

        const displayPhone = lead.remoteJid
          .replace('@s.whatsapp.net', '')
          .replace('@g.us', '')
          .replace(/\D/g, '')

        return {
          id: lead.id,
          remoteJid: lead.remoteJid,
          displayName: lastMessage?.pushName || displayPhone,
          displayPhone,
          status: lead.status,
          isHot: lead.isHot,
          lastMessage: lastMessage?.messageText || '',
          lastMessageAt: lastMessage?.timestamp || lead.createdAt,
          assignedTo: lead.assignedTo,
          campaign: lead.campaign, 
          notes: lead.notes,
          createdAt: lead.createdAt
        }
      })
    )

    return NextResponse.json({ leads: leadsWithMessages })
  } catch (error) {
    console.error('Erro ao buscar leads:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar leads' },
      { status: 500 }
    )
  }
}