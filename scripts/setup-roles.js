// scripts/setup-roles.js
// Atualiza usuários existentes para ADMIN e cria um usuário de teste (USER)
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // 1. Atualiza todos os usuários existentes para ADMIN
  const existingUsers = await prisma.user.findMany()

  for (const user of existingUsers) {
    if (user.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' }
      })
      console.log(`[ADMIN] ${user.name} (${user.email}) atualizado para ADMIN`)
    } else {
      console.log(`[ADMIN] ${user.name} (${user.email}) já é ADMIN`)
    }
  }

  // 2. Cria usuário de teste com role USER
  const testEmail = 'teste@multsorriso.com'
  const testPassword = 'teste123'

  const existingTest = await prisma.user.findUnique({
    where: { email: testEmail }
  })

  if (existingTest) {
    // Atualiza para garantir que é USER
    await prisma.user.update({
      where: { email: testEmail },
      data: { role: 'USER' }
    })
    console.log(`\n[USER] Usuário de teste já existe, role atualizado para USER`)
  } else {
    const hashedPassword = await bcrypt.hash(testPassword, 10)

    await prisma.user.create({
      data: {
        name: 'Usuário Teste',
        email: testEmail,
        password: hashedPassword,
        role: 'USER'
      }
    })
    console.log(`\n[USER] Usuário de teste criado!`)
  }

  console.log('\n========================================')
  console.log('Usuário de teste para validação:')
  console.log('Email: teste@multsorriso.com')
  console.log('Senha: teste123')
  console.log('Role: USER')
  console.log('Acesso: Campanhas, Contatos, Conversas')
  console.log('========================================')
}

main()
  .catch((e) => {
    console.error('Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
