// E04 · Borda na Vercel: proxy /api para as Edge Functions, cabeçalhos de segurança e SPA.
// Compilado para vercel.json no build. Variáveis por ambiente no projeto da Vercel:
//   SUPABASE_FUNCTIONS_URL  ex.: https://<ref>.supabase.co/functions/v1   (preview → addegas-dev, produção → addegas-prd)
//   APP_KIND                "app" (app.addegas.com.br) ou "admin" (admin.addegas.com.br, projeto separado, D47)
//   CSP_ENFORCE             "true" depois de uma semana sem violação inesperada (começa em report-only)
import { routes, type VercelConfig } from '@vercel/config/v1'

const functions = process.env.SUPABASE_FUNCTIONS_URL ?? 'http://127.0.0.1:57321/functions/v1'
const supabaseOrigin = new URL(functions).origin
const isAdmin = process.env.APP_KIND === 'admin'

const csp = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace('https://', 'wss://')} https://challenges.cloudflare.com`,
  'frame-src https://challenges.cloudflare.com https://checkout.stripe.com https://billing.stripe.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  'report-uri /api/logs',
].join('; ')

export const config: VercelConfig = {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    // O app da adega não alcança a admin-api, e o admin só alcança ela (E04).
    ...(isAdmin
      ? [routes.rewrite('/api/admin/(.*)', `${functions}/admin/$1`), routes.rewrite('/api/(.*)', `${functions}/not-found`)]
      : [routes.rewrite('/api/admin/(.*)', `${functions}/not-found`), routes.rewrite('/api/hooks/(.*)', `${functions}/hooks-$1`),
         routes.rewrite('/api/(.*)', `${functions}/$1`)]),
    routes.rewrite('/(.*)', '/index.html'),
  ],
  headers: [
    routes.header('/(.*)', [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      // Câmera liberada só para ler código de barras no caixa (E04).
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
      { key: process.env.CSP_ENFORCE === 'true' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', value: csp },
    ]),
    // Service worker sem cache HTTP, senão a versão nova demora a chegar (E54).
    routes.header('/sw.js', [{ key: 'Cache-Control', value: 'no-cache' }]),
    routes.header('/manifest.webmanifest', [{ key: 'Content-Type', value: 'application/manifest+json' }]),
    routes.cacheControl('/assets/(.*)', { public: true, maxAge: '1 year', immutable: true }),
  ],
}
