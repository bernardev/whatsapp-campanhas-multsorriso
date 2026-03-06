// scripts/fix-instance-ids.js
// Corrige instanceIds antigos nos ConversationMessages
// que armazenam instanceKey (string) ao invés do CUID do banco
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Busca todas as instâncias para mapear instanceKey → id
  const instances = await prisma.whatsAppInstance.findMany({
    select: { id: true, instanceKey: true, name: true }
  })

  console.log(`[Fix] ${instances.length} instância(s) encontradas:`)
  for (const inst of instances) {
    console.log(`  - ${inst.name}: key="${inst.instanceKey}" → id="${inst.id}"`)
  }

  // Para cada instância, atualiza messages que usam instanceKey como instanceId
  let totalUpdated = 0

  for (const inst of instances) {
    // Pula se o instanceKey é igual ao id (já está correto)
    if (inst.instanceKey === inst.id) continue

    const result = await prisma.conversationMessage.updateMany({
      where: { instanceId: inst.instanceKey },
      data: { instanceId: inst.id }
    })

    if (result.count > 0) {
      console.log(`[Fix] ${result.count} mensagens corrigidas: "${inst.instanceKey}" → "${inst.id}"`)
      totalUpdated += result.count
    }
  }

  if (totalUpdated === 0) {
    console.log('[Fix] Nenhuma mensagem precisou ser corrigida.')
  } else {
    console.log(`[Fix] Total: ${totalUpdated} mensagens corrigidas.`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
