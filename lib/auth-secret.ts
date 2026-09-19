// lib/auth-secret.ts
// Fonte ÚNICA do segredo que assina/verifica o JWT do cookie `auth-token`.
//
// Regras:
//  - NÃO existe fallback. Sem NEXTAUTH_SECRET (ou com valor fraco) este módulo
//    LANÇA no momento em que é carregado, então o app falha na subida
//    (next.config.mjs, instrumentation.ts e qualquer rota que importe isto),
//    em vez de assinar tokens com um valor conhecido.
//  - Nenhum outro arquivo deve ler process.env.NEXTAUTH_SECRET diretamente.
//  - Nunca importar isto em Client Component.

const MIN_SECRET_LENGTH = 32

function loadJwtSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET?.trim()

  if (!raw) {
    throw new Error(
      '[auth] NEXTAUTH_SECRET não está definida. O app não sobe sem ela. ' +
        'Gere uma com `openssl rand -base64 48` e configure no .env (local) ' +
        'ou em Vercel > Settings > Environment Variables (Production e Preview).'
    )
  }

  if (raw.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `[auth] NEXTAUTH_SECRET muito curta (${raw.length} caracteres; mínimo ${MIN_SECRET_LENGTH}). ` +
        'Gere uma nova com `openssl rand -base64 48`.'
    )
  }

  return new TextEncoder().encode(raw)
}

/** Chave HS256 usada por SignJWT (login) e jwtVerify (lib/auth.ts). */
export const JWT_SECRET: Uint8Array = loadJwtSecret()

/** Algoritmo aceito na verificação — o login assina com HS256. */
export const JWT_ALG = 'HS256'

/** Nome do cookie de sessão. */
export const AUTH_COOKIE = 'auth-token'
