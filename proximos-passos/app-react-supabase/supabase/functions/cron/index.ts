// Rotinas disparadas pelo pg_cron via pg_net (supabase/cron/agendar-funcoes.sql), protegidas por CRON_SECRET.
//   POST /api/cron/billing   9h (São Paulo): reconfere no Stripe quem está com a carência vencida e roda o ciclo (E33, §8)
//   POST /api/cron/webhooks  a cada 1 min: processa a caixa de entrada do Stripe (E42)
//   POST /api/cron/outbox    a cada 1 min: envia WhatsApp e e-mail da fila, reconferindo a condição (E35, E45)
import { correlationId, fail, ok, subpath } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { priv, privRows } from "../_shared/supabase.ts";
import { sendEmail, sendWhatsApp } from "../_shared/senders.ts";
import { stripe, stripeConfigured } from "../_shared/stripe.ts";

type InboxRow = { id: string; event_type: string; payload: Record<string, any> };
type OutboxRow = { id: string; channel: "whatsapp" | "email"; to_address: string; template_code: string; vars: Record<string, string> };

async function processStripeEvent(row: InboxRow, cid: string) {
  const obj = row.payload?.data?.object ?? {};
  switch (row.event_type) {
    case "invoice.paid": {
      const line = obj.lines?.data?.[0]?.period ?? {};
      const acc = await priv<string>("billing_record_invoice", {
        p_customer_id: obj.customer, p_invoice_id: obj.id, p_amount: obj.amount_paid ?? obj.total, p_status: "paid",
        p_period_start: new Date((line.start ?? obj.period_start) * 1000).toISOString(),
        p_period_end: new Date((line.end ?? obj.period_end) * 1000).toISOString(),
        p_hosted_url: obj.hosted_invoice_url ?? null, p_payment_id: obj.payment_intent ?? obj.charge ?? obj.id,
      }, { cid });
      await priv("billing_paid", {
        p_account_id: acc, p_period_start: new Date((line.start ?? obj.period_start) * 1000).toISOString(),
        p_period_end: new Date((line.end ?? obj.period_end) * 1000).toISOString(), p_author: "webhook:stripe",
      }, { cid });
      break;
    }
    case "invoice.payment_failed": {
      const acc = await priv<string>("billing_record_invoice", {
        p_customer_id: obj.customer, p_invoice_id: obj.id, p_amount: obj.amount_due ?? obj.total, p_status: "open",
        p_period_start: new Date(obj.period_start * 1000).toISOString(), p_period_end: new Date(obj.period_end * 1000).toISOString(),
        p_hosted_url: obj.hosted_invoice_url ?? null,
      }, { cid });
      await priv("billing_failed", { p_account_id: acc, p_author: "webhook:stripe" }, { cid });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created":
    case "customer.subscription.deleted": {
      // A ordem dos eventos não é garantida: quando dá, busca o estado atual no Stripe (E34).
      const sub = stripeConfigured() && row.event_type !== "customer.subscription.deleted"
        ? await stripe<Record<string, any>>("GET", `/subscriptions/${obj.id}`) : obj;
      const extraPrice = Deno.env.get("STRIPE_EXTRA_STORE_PRICE_IDS")?.split(",") ?? [];
      const extra = (sub.items?.data ?? []).filter((i: any) => extraPrice.includes(i.price?.id)).reduce((n: number, i: any) => n + (i.quantity ?? 0), 0);
      await priv("billing_sync_subscription", {
        p_customer_id: sub.customer, p_subscription_id: sub.id, p_status: sub.status,
        p_cancel_at_period_end: !!sub.cancel_at_period_end,
        p_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
        p_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        p_cycle: sub.metadata?.cycle ?? null, p_extra_stores: extra,
      }, { cid });
      break;
    }
    default:
      break; // eventos que não usamos ficam registrados e marcados como processados
  }
}

Deno.serve(async (req) => {
  const cid = correlationId(req);
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET") || !Deno.env.get("CRON_SECRET")) {
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
