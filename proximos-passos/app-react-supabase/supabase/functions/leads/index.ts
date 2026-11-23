// E48/E53 · POST /api/leads: formulário "Quero falar com alguém" da landing, com captcha (Turnstile).
import { clientIp, correlationId, fail, ok, preflight, readJson } from "../_shared/http.ts";
import { logError, rateLimited } from "../_shared/log.ts";
import { priv } from "../_shared/supabase.ts";

async function turnstileOk(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) return Deno.env.get("APP_ENV") === "local"; // sem segredo, só aceita no ambiente local
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  return (await res.json()).success === true;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cid = correlationId(req);
  if (req.method !== "POST") return fail(req, cid, "METHOD_NOT_ALLOWED", 405);
  const ip = clientIp(req);
  // Extra em memória (por instância, por um IP que o cliente pode forjar); o limite que vale é o do banco
  // (private.lead_from_landing: por telefone e no total).
  if (rateLimited(`leads:${ip}`, 5, 600_000)) return fail(req, cid, "RATE_LIMITED", 429);
  const body = await readJson<Record<string, unknown>>(req, 8_000);
  if (!body) return fail(req, cid, "PAYLOAD_INVALID");
  if (!(await turnstileOk(body.captcha as string | undefined, ip))) return fail(req, cid, "CAPTCHA_INVALID", 400);
  try {
    const res = await priv<{ ok: boolean; error?: { code: string } }>("lead_from_landing", {
      p: { name: body.name, store_name: body.store_name, phone: body.phone, email: body.email, neighborhood: body.neighborhood,
           city: body.city, utm: body.utm ?? {} },
    }, { cid, ip });
    return res.ok ? ok(req, cid) : fail(req, cid, res.error!.code, res.error!.code === "RATE_LIMITED" ? 429 : 400);
  } catch (e) {
    await logError("leads", cid, e);
    return fail(req, cid, "INTERNAL", 500);
  }
});
