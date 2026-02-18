// scripts/start-worker.ts
import 'dotenv/config'
import '../lib/worker'

console.log('Worker iniciado e aguardando mensagens...')

// Mantém o processo rodando
process.on('SIGINT', () => {
  console.log('Worker encerrado')
  process.exit(0)
})