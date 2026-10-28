// Respostas, CORS e ID de correlação (E04, E05). Todas as funções usam isto.

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://app.addegas.com.br,https://admin.addegas.com.br,https://www.addegas.com.br,http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-correlation-id, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": "x-correlation-id",
    "Vary": "Origin",
  };
}

// O front manda um por ação do usuário; se não vier, a função cria um.
export function correlationId(req: Request): string {
  return req.headers.get("x-correlation-id") ?? crypto.randomUUID();
}

export function json(req: Request, cid: string, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "x-correlation-id": cid },
  });
}

export function ok(req: Request, cid: string, data: unknown = {}): Response {
  return json(req, cid, { ok: true, data });
}

// Erros com código estável, no mesmo formato das RPCs (private.err).
export function fail(req: Request, cid: string, code: string, status = 400, detail?: string): Response {
  return json(req, cid, { ok: false, error: { code, detail: detail ?? null } }, status);
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders(req) }) : null;
}

// Rota dentro da função: /functions/v1/<nome>/<resto> e /api/<nome>/<resto> viram "<resto>".
export function subpath(req: Request, fn: string): string {
  const path = new URL(req.url).pathname;
  const i = path.indexOf(`/${fn}`);
  return i < 0 ? "" : path.slice(i + fn.length + 1).replace(/^\/+|\/+$/g, "");
}

export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 64_000): Promise<T | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return null;
  }
}

// IP real repassado pela Vercel/Kong; só usado para limite de taxa e auditoria.
export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
