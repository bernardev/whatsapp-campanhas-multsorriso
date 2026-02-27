// scripts/limpar-conversas.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️ Limpando conversas...')

  const mensagens = await prisma.conversationMessage.deleteMany({})
  console.log(`✅ ${mensagens.count} mensagens deletadas`)

  const respostas = await prisma.conversationResponse.deleteMany({})
  console.log(`✅ ${respostas.count} respostas deletadas`)

  const leads = await prisma.lead.deleteMany({})
  console.log(`✅ ${leads.count} leads deletados`)

  console.log('🎉 Pronto! Agora clique em Sincronizar no sistema.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())