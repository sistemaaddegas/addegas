// E05 · POST /api/logs: erros do front e violações de CSP (report-to), com limite de tamanho e de taxa.
// A rota aceita chamada sem login (a página de erro e o relatório de CSP não têm token). Por isso o banco
// (private.log_from_front) limita por usuário e no total dos anônimos, e só grava a loja se a pessoa for dela:
// sem isso, qualquer um encheria o monitoramento com erros "da loja X".
import { clientIp, correlationId, fail, ok, preflight, readJson } from "../_shared/http.ts";
import { rateLimited } from "../_shared/log.ts";
import { caller, priv } from "../_shared/supabase.ts";

type FrontLog = { level?: string; message?: string; code?: string; context?: Record<string, unknown>; store_id?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cid = correlationId(req);
  if (req.method !== "POST") return fail(req, cid, "METHOD_NOT_ALLOWED", 405);

  // Extra em memória (por instância); o limite que vale é o do banco.
  const ip = clientIp(req) ?? "sem-ip";
  if (rateLimited(`logs:${ip}`, 30, 60_000)) return fail(req, cid, "RATE_LIMITED", 429);

  const body = await readJson<FrontLog | { "csp-report"?: Record<string, unknown> }>(req, 16_000);
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(req, cid, "PAYLOAD_INVALID", 413);

  const user = await caller(req).catch(() => null);
  const isCsp = "csp-report" in body;
  const entry = body as FrontLog;
  const context = isCsp ? (body as Record<string, unknown>)["csp-report"] : entry.context;

  const saved = await priv<boolean>("log_from_front", {
    p_user: user?.id ?? null,
    p_source: isCsp ? "security" : "front",
    p_level: isCsp ? "warn" : String(entry.level ?? "error"),
    p_message: isCsp ? "Violação de CSP" : String(entry.message ?? "sem mensagem").slice(0, 2000),
    p_code: isCsp ? "CSP_VIOLATION" : entry.code ? String(entry.code).slice(0, 80) : null,
    p_context: {
      ...(context && typeof context === "object" && !Array.isArray(context) ? context : {}),
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    p_store_id: typeof entry.store_id === "string" && UUID.test(entry.store_id) ? entry.store_id : null,
  }, { cid, ip, userId: user?.id ?? null });

  return saved ? ok(req, cid) : fail(req, cid, "RATE_LIMITED", 429);
});
