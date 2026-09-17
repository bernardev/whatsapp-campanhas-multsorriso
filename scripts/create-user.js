// scripts/create-user.js
// Cria um usuário ADMIN.
//
// SEGURANÇA: nunca deixe senha fixa neste arquivo — o repositório é público.
// Passe por variável de ambiente ou deixe o script gerar uma senha forte.
//   USER_EMAIL=... USER_NAME="..." USER_PASSWORD=... node scripts/create-user.js
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

const prisma = new PrismaClient()

function gerarSenha() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', a = 'abcdefghijkmnopqrstuvwxyz'
  const n = '23456789', s = '!@#$%&*'
  const todos = A + a + n + s
  let out = A[crypto.randomInt(A.length)] + a[crypto.randomInt(a.length)] +
            n[crypto.randomInt(n.length)] + s[crypto.randomInt(s.length)]
  for (let i = 0; i < 12; i++) out += todos[crypto.randomInt(todos.length)]
  return out
}

async function main() {
  const email = process.env.USER_EMAIL
  const name = process.env.USER_NAME
  if (!email || !name) {
    console.error('Uso: USER_EMAIL=... USER_NAME="..." [USER_PASSWORD=...] node scripts/create-user.js')
    process.exit(1)
  }

  const senha = process.env.USER_PASSWORD || gerarSenha()
  const gerada = !process.env.USER_PASSWORD

  const user = await prisma.user.create({
    data: { name, email, password: await bcrypt.hash(senha, 10), role: 'ADMIN' },
  })

  console.log('Usuário criado com sucesso!')
  console.log('Email:', user.email)
  console.log('Role:', user.role)
  if (gerada) {
    console.log('Senha gerada:', senha)
    console.log('>>> Anote agora e repasse por canal seguro. Não será exibida de novo.')
  }
}

main()
  .catch((e) => { console.error('Erro:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
