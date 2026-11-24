// Rotinas disparadas pelo pg_cron via pg_net (supabase/cron/agendar-funcoes.sql), protegidas por CRON_SECRET.
//   POST /api/cron/billing   9h (São Paulo): reconfere no Stripe quem está com a carência vencida e roda o ciclo (E33, §8)
//   POST /api/cron/webhooks  a cada 1 min: processa a caixa de entrada do Stripe (E42)
//   POST /api/cron/outbox    a cada 1 min: envia WhatsApp e e-mail da fila, reconferindo a condição (E35, E45)
import { correlationId, fail, ok, safeEqual, subpath } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { priv, privRows } from "../_shared/supabase.ts";
import { sendEmail, sendWhatsApp } from "../_shared/senders.ts";
import { stripe, stripeConfigured } from "../_shared/stripe.ts";
import { syncDispute, syncInvoice, syncRefunds, syncSubscription } from "../_shared/billing-sync.ts";

type InboxRow = { id: string; event_type: string; payload: Record<string, any> };
type OutboxRow = { id: string; channel: "whatsapp" | "email"; to_address: string; template_code: string; vars: Record<string, string> };

/**
 * Eventos do Stripe que mexem na assinatura (a lista assinada no endpoint fica no scripts/stripe-sync.mjs). Cada um
 * busca o estado atual no Stripe (billing-sync.ts), então repetir ou receber fora de ordem não estraga nada.
 */
async function processStripeEvent(row: InboxRow, cid: string) {
  const obj = row.payload?.data?.object ?? {};
  const ctx = { cid };
  switch (row.event_type) {
    // Volta do checkout: liga a assinatura e a primeira fatura (os eventos dela também chegam, sem duplicar).
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
      if (obj.subscription) await syncSubscription(obj.subscription, ctx);
      if (obj.invoice) await syncInvoice(obj.invoice, ctx, { falhou: row.event_type === "checkout.session.async_payment_failed" });
      break;
    // Assinatura criada, renovada, trocada de ciclo ou de lojas, marcada para cancelar, pausada ou encerrada.
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(obj.id, ctx);
      break;
    // Renovação paga, cartão recusado, banco pedindo confirmação (3DS), fatura anulada ou dada como incobrável.
    case "invoice.paid":
    case "invoice.voided":
    case "invoice.marked_uncollectible":
      await syncInvoice(obj.id, ctx);
      break;
    case "invoice.payment_failed":
    case "invoice.payment_action_required":
      await syncInvoice(obj.id, ctx, { falhou: true });
      break;
    // Estorno: total ou parcial, pelo painel do Stripe ou pela equipe.
    case "charge.refunded":
    case "charge.refund.updated":
      await syncRefunds(row.event_type === "charge.refund.updated" ? obj.charge : obj.id, ctx);
      break;
    // Contestação (chargeback): aberta, com prazo de defesa, decidida.
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
    case "charge.dispute.funds_withdrawn":
    case "charge.dispute.funds_reinstated":
      await syncDispute(obj.id, ctx);
      break;
    default:
      break; // eventos que não usamos ficam registrados e marcados como processados
  }
}

Deno.serve(async (req) => {
  const cid = correlationId(req);
  if (req.method !== "POST" || !safeEqual(req.headers.get("x-cron-secret"), Deno.env.get("CRON_SECRET"))) {
    return fail(req, cid, "FORBIDDEN", 403);
  }
  const route = subpath(req, "cron");
  try {
    if (route === "webhooks") {
      const rows = await privRows<InboxRow>("inbox_claim", { p_provider: "stripe", p_limit: 20 }, { cid });
      let done = 0;
      for (const row of rows) {
        try {
          await processStripeEvent(row, cid);
          await priv("inbox_done", { p_id: row.id }, { cid });
          done++;
        } catch (e) {
          await priv("inbox_fail", { p_id: row.id, p_error: e instanceof Error ? e.message : String(e) }, { cid });
        }
      }
      return ok(req, cid, { claimed: rows.length, processed: done });
    }

    if (route === "outbox") {
      let sent = 0;
      for (const channel of ["whatsapp", "email"] as const) {
        const rows = await privRows<OutboxRow>("outbox_claim", { p_channel: channel, p_limit: 30 }, { cid });
        for (const m of rows) {
          const r = await priv<{ subject: string | null; body: string }>("render_template",
            { p_code: m.template_code, p_channel: m.channel, p_vars: m.vars }, { cid });
          const res = channel === "email"
            ? await sendEmail(m.to_address, r.subject ?? "Addegas", r.body, Deno.env.get("EMAIL_REPLY_TO_BILLING") ?? undefined)
            : await sendWhatsApp(m.to_address, r.body);
          await priv("outbox_result", { p_id: m.id, p_ok: res.ok, p_provider_id: res.providerId ?? null, p_error: res.error ?? null }, { cid });
          if (res.ok) sent++;
        }
      }
      return ok(req, cid, { sent });
    }

    if (route === "billing") {
      // Reconfere no Stripe antes de suspender (§8): só entra na lista quem continua sem pagar.
      const candidates = await priv<{ account_id: string; stripe_subscription_id: string | null }[]>("billing_overdue_candidates", {}, { cid });
      const unpaid: string[] = [];
      for (const c of candidates) {
        if (!c.stripe_subscription_id || !stripeConfigured()) {
          unpaid.push(c.account_id);
          continue;
        }
        const sub = await stripe<{ status: string }>("GET", `/subscriptions/${c.stripe_subscription_id}`);
        if (sub.status !== "active" && sub.status !== "trialing") unpaid.push(c.account_id);
      }
      const result = await priv("run_billing_cycle", { p_confirmed_unpaid: unpaid }, { cid });
      return ok(req, cid, { checked: candidates.length, unpaid: unpaid.length, result });
    }

    return fail(req, cid, "NOT_FOUND", 404);
  } catch (e) {
    await logError("cron", cid, e, { route });
    return fail(req, cid, "INTERNAL", 500);
  }
});
