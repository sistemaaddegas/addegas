// E34/E42 · POST /api/hooks/stripe: confere a assinatura, grava o evento bruto e responde 200 rápido.
// O processamento é feito pela função cron (rota webhooks), com retentativa e sem duplicar.
import { correlationId, fail, json } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { priv } from "../_shared/supabase.ts";
import { verifyStripeSignature } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const cid = correlationId(req);
  if (req.method !== "POST") return fail(req, cid, "METHOD_NOT_ALLOWED", 405);
  const raw = await req.text();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret || !(await verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret))) {
    // Rejeitado: registra só o fato, sem o payload.
    await logError("hooks-stripe", cid, new Error("assinatura do Stripe inválida"), { code: "WEBHOOK_SIGNATURE_INVALID" });
    return fail(req, cid, "WEBHOOK_SIGNATURE_INVALID", 400);
  }
  try {
    const event = JSON.parse(raw) as { id: string; type: string };
    const res = await priv<{ id: string; duplicate: boolean }>("inbox_receive",
      { p_provider: "stripe", p_event_id: event.id, p_type: event.type, p_payload: event }, { cid });
    return json(req, cid, { received: true, duplicate: res.duplicate });
  } catch (e) {
    await logError("hooks-stripe", cid, e);
    return fail(req, cid, "INTERNAL", 500); // o Stripe tenta de novo
  }
});
