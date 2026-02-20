// scripts/limpar-dados.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️ Iniciando limpeza...')

  // 1. Deleta instâncias (soft delete)
  const instancias = await prisma.whatsAppInstance.updateMany({
    where: { isActive: true },
    data: { 
      isActive: false,
      status: 'deleted'
    }
  })
  console.log(`✅ ${instancias.count} instância(s) desativada(s)`)

  // 2. Deleta mensagens de conversas
  const conversas = await prisma.conversationMessage.deleteMany({})
  console.log(`✅ ${conversas.count} mensagem(ns) de conversa deletada(s)`)

  // 3. Deleta respostas de conversas (notificações)
  const respostas = await prisma.conversationResponse.deleteMany({})
  console.log(`✅ ${respostas.count} resposta(s) deletada(s)`)

  // 4. Deleta leads
  const leads = await prisma.lead.deleteMany({})
  console.log(`✅ ${leads.count} lead(s) deletado(s)`)

  console.log('🎉 Limpeza concluída!')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })