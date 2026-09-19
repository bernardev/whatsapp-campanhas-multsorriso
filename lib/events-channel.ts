// lib/events-channel.ts
// Constante isolada, SEM efeitos colaterais: importar daqui NÃO abre conexão Redis.
// (Importar de '@/lib/redis-pubsub' instancia redisPub no carregamento do módulo.)
export const EVENTS_CHANNEL = 'whatsapp:eventos'
