// Falha cedo (next dev / next build / next start e build da Vercel) se o segredo
// do JWT estiver ausente ou fraco. A mesma regra vale em runtime via lib/auth-secret.ts.
const jwtSecret = process.env.NEXTAUTH_SECRET?.trim()
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    '[config] NEXTAUTH_SECRET ausente ou com menos de 32 caracteres. ' +
      'Gere com `openssl rand -base64 48` e configure no .env (local) ou na Vercel (Production e Preview).'
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), '@prisma/client', '@prisma/engines'];
    }
    return config;
  },
};
export default nextConfig;