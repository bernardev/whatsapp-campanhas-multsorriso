// scripts/create-franciele.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  // Gera senha aleatória segura
  const randomPassword = crypto.randomBytes(8).toString('hex')
  const hashedPassword = await bcrypt.hash(randomPassword, 10)
  
  const user = await prisma.user.create({
    data: {
      name: 'Franciele',
      email: 'franciele@multsorriso.com',
      password: hashedPassword
    }
  })

  console.log('✅ Usuária criada com sucesso!')
  console.log('Nome:', user.name)
  console.log('Email:', user.email)
  console.log('Senha:', randomPassword)
  console.log('')
  console.log('⚠️ IMPORTANTE: Salve essa senha! Não será possível recuperá-la!')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })