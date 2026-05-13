// app/api/whatsapp/templates/route.ts
// Lista templates aprovados na Meta (WABA) — usado pela tela de Nova Campanha
// quando a instância selecionada é CLOUD_API. Faz proxy ao Evolution
// `/template/find/{instance}` que internamente consulta a Graph API.

import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface MetaTemplateParam {
  type: string
  text?: string
}
interface MetaComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  text?: string
  format?: string
  example?: { body_text?: string[][] }
  buttons?: { type: string; text: string }[]
  parameters?: MetaTemplateParam[]
}
interface MetaTemplate {
  id: string
  name: string
  status: string
  language: string
  category: string
  components: MetaComponent[]
}

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://31.97.42.88:8082'
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || 'apikey321'

function countBodyParams(tpl: MetaTemplate): number {
  const body = tpl.components.find((c) => c.type === 'BODY')
  if (!body?.text) return 0
  const matches = body.text.match(/\{\{\d+\}\}/g)
  return matches ? matches.length : 0
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instanceId')

    if (!instanceId) {
      return NextResponse.json(
        { error: 'instanceId é obrigatório' },
        { status: 400 }
      )
    }

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance) {
      return NextResponse.json(
        { error: 'Instância não encontrada' },
        { status: 404 }
      )
    }

    if (instance.provider !== 'CLOUD_API') {
      return NextResponse.json({ templates: [] })
    }

    // Evolution expõe `/template/find/{instance}` que retorna os templates
    // aprovados na WABA associada (status, language, name, components).
    const url = `${EVOLUTION_URL}/template/find/${encodeURIComponent(instance.instanceKey)}`
    const response = await fetch(url, {
      headers: { apikey: EVOLUTION_KEY },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[Templates] Evolution erro:', response.status, text)
      return NextResponse.json(
        { error: 'Falha ao consultar Evolution', detail: text },
        { status: 502 }
      )
    }

    const raw = (await response.json()) as { data?: MetaTemplate[] } | MetaTemplate[]
    const list: MetaTemplate[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : []

    const templates = list
      .filter((t) => t.status === 'APPROVED')
      .map((t) => ({
        id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        bodyParamsCount: countBodyParams(t),
        bodyText:
          t.components.find((c) => c.type === 'BODY')?.text || '',
        headerText:
          t.components.find((c) => c.type === 'HEADER')?.text || '',
      }))

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('[Templates] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao listar templates' },
      { status: 500 }
    )
  }
}
