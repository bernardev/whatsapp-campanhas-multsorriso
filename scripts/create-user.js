// scripts/create-user.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10)
  
  const user = await prisma.user.create({
    data: {
      name: 'Eduardo Bernardes',
      email: 'eduardo@multsorriso.com',
      password: hashedPassword
    }
  })

  console.log('Usuário criado com sucesso!')
  console.log('Email:', user.email)
  console.log('Senha: 123456')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })