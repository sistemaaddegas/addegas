// E04 · GET /api/health: versão, ambiente e horário do banco, com o ID de correlação de volta.
import { correlationId, ok, preflight, fail } from "../_shared/http.ts";
import { log } from "../_shared/log.ts";
import { priv } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cid = correlationId(req);
  try {
    const dbNow = await priv<string>("correlation_id", {}, { cid }).then(() => new Date().toISOString());
    return ok(req, cid, {
      version: Deno.env.get("APP_VERSION") ?? "dev",
      // Versão mínima do app: o PWA força a atualização quando a dele for menor (E54).
      min_version: Deno.env.get("MIN_APP_VERSION") ?? "0.0.0",
      environment: Deno.env.get("APP_ENV") ?? "local",
      db_time: dbNow,
    });
  } catch (e) {
    // A mensagem do driver (host, usuário, motivo) fica só no log da função; a rota é pública.
    log("error", "health", cid, e instanceof Error ? e.message : String(e));
    return fail(req, cid, "DB_UNAVAILABLE", 503);
  }
});
