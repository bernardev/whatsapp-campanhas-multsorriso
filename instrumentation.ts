// instrumentation.ts
// register() roda uma vez quando o servidor Next sobe (next start, next dev e
// cada cold start de função na Vercel). Importar o módulo do segredo aqui faz o
// servidor falhar na subida se NEXTAUTH_SECRET estiver ausente/fraca, em vez de
// só quebrar na primeira requisição autenticada.
export async function register() {
  await import('./lib/auth-secret')
}
