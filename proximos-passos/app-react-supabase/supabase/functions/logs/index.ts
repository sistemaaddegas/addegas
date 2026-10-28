// E05 · POST /api/logs: erros do front e violações de CSP (report-to), com limite de tamanho e de taxa.
import { clientIp, correlationId, fail, ok, preflight, readJson } from "../_shared/http.ts";
import { rateLimited } from "../_shared/log.ts";
import { caller, priv } from "../_shared/supabase.ts";

type FrontLog = { level?: string; message?: string; code?: string; context?: Record<string, unknown>; store_id?: string };

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cid = correlationId(req);
  if (req.method !== "POST") return fail(req, cid, "METHOD_NOT_ALLOWED", 405);

  const ip = clientIp(req) ?? "sem-ip";
  if (rateLimited(`logs:${ip}`, 30, 60_000)) return fail(req, cid, "RATE_LIMITED", 429);

  const body = await readJson<FrontLog | { "csp-report"?: Record<string, unknown> }>(req, 16_000);
  if (!body) return fail(req, cid, "PAYLOAD_INVALID", 413);

  const user = await caller(req).catch(() => null);
  const isCsp = "csp-report" in body;
  const entry = body as FrontLog;
  const level = isCsp ? "warn" : ["debug", "info", "warn", "error"].includes(entry.level ?? "") ? entry.level! : "error";

  await priv("log", {
    p_source: isCsp ? "security" : "front",
    p_level: level,
    p_message: isCsp ? "Violação de CSP" : String(entry.message ?? "sem mensagem").slice(0, 2000),
    p_code: isCsp ? "CSP_VIOLATION" : entry.code ?? null,
    p_context: isCsp ? (body as Record<string, unknown>)["csp-report"] : { ...(entry.context ?? {}), user_agent: req.headers.get("user-agent") },
    p_store_id: entry.store_id ?? null,
  }, { cid, ip, userId: user?.id ?? null });

  return ok(req, cid);
});
