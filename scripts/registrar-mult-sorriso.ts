// scripts/registrar-mult-sorriso.ts
// Registra a instância Cloud API "mult-sorriso-curitiba" no banco do sistema.
// Idempotente: rodar 2x não duplica nem quebra.
//
// Uso:
//   npx tsx scripts/registrar-mult-sorriso.ts            (cadastra com isActive=false)
//   npx tsx scripts/registrar-mult-sorriso.ts --active   (cadastra com isActive=true)
//
// isActive=false (padrão): instância existe no DB mas não entra no round-robin
// de campanhas atuais (que usam sendTextMessage). Use sendTemplateMessage
// importando direto: import { sendTemplateMessage } from '@/lib/evolution'.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INSTANCE_KEY = 'mult-sorriso-curitiba'
const INSTANCE_NAME = 'Mult Sorriso Curitiba'
const PHONE = '554197434198'

async function main(): Promise<void> {
  const isActive = process.argv.includes('--active')

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  })

  if (!admin) {
    console.error('❌ Nenhum usuário ADMIN encontrado. Crie um admin antes.')
    process.exit(1)
  }

  const instance = await prisma.whatsAppInstance.upsert({
    where: { instanceKey: INSTANCE_KEY },
    update: {
      name: INSTANCE_NAME,
      phone: PHONE,
      status: 'connected',
      isActive,
    },
    create: {
      name: INSTANCE_NAME,
      instanceKey: INSTANCE_KEY,
      phone: PHONE,
      status: 'connected',
      isActive,
      userId: admin.id,
    },
  })

  console.log('✅ Instância registrada/atualizada:')
  console.log(`   id:          ${instance.id}`)
  console.log(`   instanceKey: ${instance.instanceKey}`)
  console.log(`   name:        ${instance.name}`)
  console.log(`   phone:       ${instance.phone}`)
  console.log(`   status:      ${instance.status}`)
  console.log(`   isActive:    ${instance.isActive}`)
  console.log(`   userId:      ${admin.id} (${admin.email})`)

  if (!isActive) {
    console.log('')
    console.log('ℹ️  isActive=false → não aparece no /instancias e não entra no')
    console.log('    round-robin. Use via código:')
    console.log('      import { sendTemplateMessage } from "@/lib/evolution"')
    console.log('      await sendTemplateMessage("mult-sorriso-curitiba", ...)')
    console.log('')
    console.log('    Para ativar depois: rode com a flag --active')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
