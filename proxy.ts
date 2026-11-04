// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'

// shortcut: painel desligado por commit — para religar, reverter o commit que
// ligou (ou trocar para false e subir). Os webhooks ficam de fora: e por eles
// que entram as mensagens dos pacientes e os status de entrega da Meta, e o
// worker da VPS (campanhas na fila e lembretes) nao passa por aqui.
const MANUTENCAO = true

const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mult Sorriso — Manutenção</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a}
  main{max-width:420px;margin:24px;padding:40px 32px;background:#fff;border-radius:16px;
       box-shadow:0 10px 30px rgba(15,23,42,.08);text-align:center}
  h1{font-size:20px;margin:0 0 12px}
  p{font-size:15px;line-height:1.6;color:#475569;margin:0}
  .barra{width:48px;height:4px;background:#BD8F29;border-radius:2px;margin:0 auto 24px}
</style>
</head>
<body>
<main>
  <div class="barra"></div>
  <h1>Plataforma em manutenção</h1>
  <p>O acesso está temporariamente indisponível.<br>Por favor, entre em contato com o Eduardo.</p>
</main>
</body>
</html>`

export function proxy(request: NextRequest): NextResponse {
  if (!MANUTENCAO) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/webhooks/')) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Sistema em manutenção' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  return new NextResponse(PAGINA, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
