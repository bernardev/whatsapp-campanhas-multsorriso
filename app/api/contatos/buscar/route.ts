// app/api/contatos/buscar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY

interface WhatsAppContact {
  id: string
  pushName?: string
  profilePictureUrl?: string
  owner?: string
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''

    if (q.length < 2) {
      return NextResponse.json({ contatos: [] })
    }

    // Busca a instância conectada mais recente (única)
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { isActive: true, status: 'connected' },
      orderBy: { createdAt: 'desc' },
      select: { instanceKey: true }
    })

    if (!instance) {
      return NextResponse.json({ contatos: [] })
    }

    const headers: HeadersInit = {
      'apikey': EVOLUTION_KEY!,
      'Content-Type': 'application/json'
    }

    // Busca contatos do WhatsApp da instância conectada
    const allContacts: WhatsAppContact[] = []

    const res = await fetch(
      `${EVOLUTION_URL}/chat/findContacts/${instance.instanceKey}`,
      { method: 'POST', headers, body: JSON.stringify({}) }
    )

    if (res.ok) {
      const contacts: WhatsAppContact[] = await res.json()
      for (const contact of contacts) {
        if (!contact.id) continue
        // Ignora grupos e broadcasts
        if (contact.id.includes('@g.us') || contact.id.includes('status@broadcast')) continue
        allContacts.push(contact)
      }
    }

    // Filtra pelo termo de busca
    const searchLower = q.toLowerCase()
    const digits = q.replace(/\D/g, '')

    const filtered = allContacts
      .filter(contact => {
        const name = contact.pushName?.toLowerCase() || ''
        const phone = contact.id.replace(/\D/g, '')

        return name.includes(searchLower) || (digits.length >= 2 && phone.includes(digits))
      })
      .slice(0, 20)
      .map(contact => {
        const phone = contact.id.replace('@s.whatsapp.net', '').replace(/\D/g, '')
        return {
          id: contact.id,
          name: contact.pushName || null,
          phone,
          company: null as string | null
        }
      })

    return NextResponse.json({ contatos: filtered })
  } catch (error) {
    console.error('[Buscar] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar contatos' }, { status: 500 })
  }
}
