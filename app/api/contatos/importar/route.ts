// app/api/contatos/importar/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface CSVRow {
  name: string
  phone: string
  company?: string
}

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

function validarTelefone(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.length === 11) {
    return `+55${cleaned}`
  } else if (cleaned.length === 13 && cleaned.startsWith('55')) {
    return `+${cleaned}`
  } else if (cleaned.length === 14 && cleaned.startsWith('55')) {
    return `+${cleaned.slice(1)}`
  }
  
  return null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { contacts } = body as { contacts: CSVRow[] }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum contato fornecido' },
        { status: 400 }
      )
    }

    const resultados: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: []
    }

for (const contatoCSV of contacts) {
  try {
    // Valida se tem name e phone
    if (!contatoCSV.name || !contatoCSV.phone) {
      resultados.skipped++
      resultados.errors.push(
        `Linha ignorada: faltam dados obrigatórios (name: ${contatoCSV.name || 'vazio'}, phone: ${contatoCSV.phone || 'vazio'})`
      )
      continue
    }

    const phoneFormatado = validarTelefone(contatoCSV.phone)
    
    if (!phoneFormatado) {
      resultados.skipped++
      resultados.errors.push(`${contatoCSV.name}: telefone inválido (${contatoCSV.phone})`)
      continue
    }

    const existente = await prisma.contact.findFirst({
      where: { phone: phoneFormatado }
    })

    if (existente) {
      resultados.skipped++
      continue
    }

    await prisma.contact.create({
      data: {
        name: contatoCSV.name,
        phone: phoneFormatado,
        company: contatoCSV.company || null,
      }
    })

    resultados.imported++
  } catch (error) {
    resultados.skipped++
    const errorMsg = error instanceof Error ? error.message : 'erro desconhecido'
    resultados.errors.push(`${contatoCSV.name || 'sem nome'}: ${errorMsg}`)
  }
}

    return NextResponse.json(resultados)
  } catch (error) {
    console.error('[Import] Erro ao importar contatos:', error)
    return NextResponse.json(
      { error: 'Erro ao importar contatos' },
      { status: 500 }
    )
  }
}