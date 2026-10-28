// E45 · POST /api/hooks/wapi: mensagens recebidas pelo número do Addegas. "SAIR" desliga os alertas do número.
// A W-API chama com o token configurado no painel dela (WAPI_WEBHOOK_TOKEN), no header ou na query.
import { correlationId, fail, ok, readJson } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { priv } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cid = correlationId(req);
  const token = req.headers.get("x-webhook-token") ?? new URL(req.url).searchParams.get("token");
  if (!token || token !== Deno.env.get("WAPI_WEBHOOK_TOKEN")) return fail(req, cid, "FORBIDDEN", 403);
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return fail(req, cid, "PAYLOAD_INVALID");
  try {
    // Campos comuns nos webhooks da W-API; o formato exato fica conferido na integração (E45).
    const text = String((body.text as Record<string, unknown>)?.message ?? body.message ?? body.body ?? "").trim().toUpperCase();
    const phone = String(body.phone ?? body.from ?? (body.sender as Record<string, unknown>)?.id ?? "").replace(/\D/g, "");
    if (phone && ["SAIR", "PARAR", "STOP"].includes(text)) {
      const n = await priv<number>("whatsapp_opt_out", { p_phone: phone }, { cid });
      return ok(req, cid, { opted_out: n });
    }
    return ok(req, cid, { ignored: true });
  } catch (e) {
    await logError("hooks-wapi", cid, e);
    return fail(req, cid, "INTERNAL", 500);
  }
});
