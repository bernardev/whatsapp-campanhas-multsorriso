// scripts/create-user.js
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10)

  const user = await prisma.user.create({
    data: {
      name: 'Eduardo Bernardes',
      email: 'eduardo@multsorriso.com',
      password: hashedPassword,
      role: 'ADMIN'
    }
  })

  console.log('Usuário criado com sucesso!')
  console.log('Email:', user.email)
  console.log('Senha: 123456')
  console.log('Role:', user.role)
}

main()
  .catch((e) => {
    console.error('Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
