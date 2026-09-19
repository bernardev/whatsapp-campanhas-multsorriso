// scripts/criar-service-token.ts
// Gerencia tokens de serviço (apps externos server-to-server, ex.: Vitória Dental).
// O valor do token é gerado aqui, IMPRESSO UMA ÚNICA VEZ e só o sha256 vai
// para o banco. Perdeu o valor? Revogue e crie outro.
//
// Uso:
//   npx tsx scripts/criar-service-token.ts --list-instances
//   npx tsx scripts/criar-service-token.ts --name "Vitória Dental" \
//       --instances <id-ou-instanceKey>[,<id-ou-instanceKey>...] \
//       --scopes conversas:ler,conversas:enviar,conversas:responder
//   npx tsx scripts/criar-service-token.ts --list
//   npx tsx scripts/criar-service-token.ts --revoke <serviceTokenId>
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import {
  generateServiceToken,
  hashServiceToken,
  isServiceScope,
  SERVICE_SCOPES,
} from '../lib/service-token'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function csv(v: string | undefined): string[] {
  return (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}

function fail(msg: string): never {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

async function listInstances(): Promise<void> {
  const rows = await prisma.whatsAppInstance.findMany({
    select: { id: true, instanceKey: true, name: true, provider: true, status: true, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  console.table(rows)
}

async function listTokens(): Promise<void> {
  const rows = await prisma.serviceToken.findMany({
    // tokenHash fica de fora de propósito
    select: { id: true, name: true, scopes: true, instanceIds: true, active: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  console.table(rows)
}

async function revoke(id: string): Promise<void> {
  const r = await prisma.serviceToken.updateMany({ where: { id }, data: { active: false } })
  if (r.count === 0) fail(`Token ${id} não encontrado`)
  console.log(`✅ Token ${id} revogado (active=false). Chamadas com ele passam a receber 401.`)
}

async function create(): Promise<void> {
  const name = arg('--name')?.trim()
  if (!name) fail('Informe --name "Nome do app"')

  const scopes = csv(arg('--scopes'))
  if (scopes.length === 0) fail(`Informe --scopes (válidos: ${SERVICE_SCOPES.join(', ')})`)
  const invalid = scopes.filter((s) => !isServiceScope(s))
  if (invalid.length) fail(`Escopo(s) inválido(s): ${invalid.join(', ')}. Válidos: ${SERVICE_SCOPES.join(', ')}`)

  // Aceita id (cuid) OU instanceKey; grava SEMPRE o id (é o que ConversationMessage.instanceId guarda).
  const wanted = csv(arg('--instances'))
  if (wanted.length === 0) fail('Informe --instances (use --list-instances para ver os ids)')
  const found = await prisma.whatsAppInstance.findMany({
    where: { OR: [{ id: { in: wanted } }, { instanceKey: { in: wanted } }] },
    select: { id: true, instanceKey: true, name: true },
  })
  const missing = wanted.filter((w) => !found.some((f) => f.id === w || f.instanceKey === w))
  if (missing.length) fail(`Instância(s) não encontrada(s): ${missing.join(', ')}`)
  const instanceIds = [...new Set(found.map((f) => f.id))]

  const token = generateServiceToken()
  const row = await prisma.serviceToken.create({
    data: {
      name,
      tokenHash: hashServiceToken(token),
      scopes: [...new Set(scopes)],
      instanceIds,
    },
    select: { id: true },
  })

  console.log('✅ Token de serviço criado')
  console.log(`   id:         ${row.id}`)
  console.log(`   nome:       ${name}`)
  console.log(`   escopos:    ${scopes.join(', ')}`)
  console.log(`   instâncias: ${found.map((f) => `${f.name} (${f.instanceKey} → ${f.id})`).join('; ')}`)
  console.log('')
  console.log('   TOKEN (copie AGORA — não será exibido de novo, o banco só guarda o hash):')
  console.log('')
  console.log(`   ${token}`)
  console.log('')
  console.log('   Uso: Authorization: Bearer <TOKEN>')
}

async function main(): Promise<void> {
  if (process.argv.includes('--list-instances')) return listInstances()
  if (process.argv.includes('--list')) return listTokens()
  const revokeId = arg('--revoke')
  if (revokeId) return revoke(revokeId)
  return create()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
