// lib/env.ts
// Leitura de variável de ambiente obrigatória.
//
// SEGURANÇA: nunca use `process.env.X || 'valor-literal'` como fallback.
// O repositório é público — um fallback vira credencial publicada. Melhor
// falhar alto e cedo do que rodar com um segredo que todo mundo conhece.
export function requireEnv(nome: string): string {
  const valor = process.env[nome]
  if (!valor) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`)
  }
  return valor
}
