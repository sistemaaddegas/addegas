// E34 · Estado do Stripe → banco. Usado pelo processamento do webhook (cron/webhooks) e pela volta do checkout
// (billing/session-status). Sempre busca o objeto atual no Stripe: a ordem dos eventos não é garantida e o
// formato do evento depende da versão da conta; o que vem pela API segue a versão fixada (STRIPE_API_VERSION).
import { logError } from "./log.ts";
import { priv } from "./supabase.ts";
import { stripe } from "./stripe.ts";

type Ctx = { cid: string };
// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>;

const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

/** Ciclo pelo intervalo do preço do plano, quando a assinatura não veio do nosso checkout (sem metadata). */
function cicloDoPreco(price?: Obj): string | null {
  const r = price?.recurring;
  if (!r) return null;
  if (r.interval === "year") return "annual";
  if (r.interval === "month") return r.interval_count === 6 ? "semiannual" : r.interval_count === 1 ? "monthly" : null;
  return null;
}

/** Conta de outro sistema ou cliente criado à mão no painel do Stripe: registra e segue (não trava a fila). */
async function semConta(e: unknown, ctx: Ctx, oQue: string) {
  if (e instanceof Error && e.message.includes("BILLING_CUSTOMER_UNKNOWN")) {
    await logError("stripe-sync", ctx.cid, e, { code: "STRIPE_CUSTOMER_UNKNOWN", oQue });
    return;
  }
  throw e;
}

export async function syncSubscription(id: string, ctx: Ctx) {
  const sub = await stripe<Obj>("GET", `/subscriptions/${id}`);
  const extraIds = Deno.env.get("STRIPE_EXTRA_STORE_PRICE_IDS")?.split(",") ?? [];
  const itens: Obj[] = sub.items?.data ?? [];
  const extra = itens.filter((i) => extraIds.includes(i.price?.id)).reduce((n, i) => n + (i.quantity ?? 0), 0);
  const plano = itens.find((i) => !extraIds.includes(i.price?.id));
  try {
    return await priv<string>("billing_sync_subscription", {
      p_customer_id: sub.customer, p_subscription_id: sub.id, p_status: sub.status,
      p_cancel_at_period_end: !!sub.cancel_at_period_end || !!sub.cancel_at,
      p_period_start: iso(sub.current_period_start), p_period_end: iso(sub.current_period_end),
      p_cycle: sub.metadata?.cycle ?? cicloDoPreco(plano?.price), p_extra_stores: extra,
    }, ctx);
  } catch (e) { await semConta(e, ctx, `subscription ${id}`); }
}

/**
 * Fatura da assinatura. Paga → registra o pagamento e libera (renovação inclusive). Falhou ou pede confirmação
 * no banco (3DS) → registra em aberto e começa a carência de 5 dias (D28), sem reiniciar se já estava nela.
 */
export async function syncInvoice(id: string, ctx: Ctx, opts: { falhou?: boolean } = {}) {
  const inv = await stripe<Obj>("GET", `/invoices/${id}`);
  if (!inv.subscription) return; // cobrança avulsa não é da assinatura
  const linha: Obj = (inv.lines?.data ?? []).find((l: Obj) => l.type === "subscription")?.period ?? inv.lines?.data?.[0]?.period ?? {};
  const inicio = iso(linha.start ?? inv.period_start), fim = iso(linha.end ?? inv.period_end);
  try {
    if (inv.status === "void" || inv.status === "uncollectible") {
      await priv("billing_invoice_status", { p_invoice_id: inv.id, p_status: inv.status }, ctx);
      return;
    }
    if (inv.status === "draft") return;
    const paga = inv.status === "paid";
    const acc = await priv<string>("billing_record_invoice", {
      p_customer_id: inv.customer, p_invoice_id: inv.id, p_amount: paga ? inv.amount_paid : inv.amount_due, p_status: paga ? "paid" : "open",
      p_period_start: inicio, p_period_end: fim, p_hosted_url: inv.hosted_invoice_url ?? null,
      p_payment_id: paga ? (inv.payment_intent ?? inv.charge ?? inv.id) : null,
    }, ctx);
    // Fatura de valor zero (cupom de 100%) também libera.
    if (paga) await priv("billing_paid", { p_account_id: acc, p_period_start: inicio, p_period_end: fim, p_author: "webhook:stripe" }, ctx);
    else if (opts.falhou) await priv("billing_failed", { p_account_id: acc, p_author: "webhook:stripe" }, ctx);
  } catch (e) { await semConta(e, ctx, `invoice ${id}`); }
}

/** Estornos de uma cobrança (feitos no painel do Stripe ou pela equipe). */
export async function syncRefunds(chargeId: string, ctx: Ctx) {
  const ch = await stripe<Obj>("GET", `/charges/${chargeId}`, { expand: ["refunds"] });
  for (const r of ch.refunds?.data ?? []) {
    const acc = await priv<string | null>("billing_record_refund", {
      p_payment_ids: [ch.payment_intent, ch.id].filter(Boolean), p_refund_id: r.id, p_amount: r.amount,
      p_reason: { duplicate: "Cobrança duplicada", fraudulent: "Fraude", requested_by_customer: "Pedido do cliente" }[r.reason as string] ?? r.reason ?? null,
      p_status: r.status,
    }, ctx);
    if (acc && r.status === "succeeded" && ch.amount_refunded >= ch.amount) {
      await logError("stripe-sync", ctx.cid, new Error("cobrança estornada por inteiro"), { code: "STRIPE_FULL_REFUND", account_id: acc, charge: ch.id });
    }
  }
}

/** Contestação (chargeback): grava e avisa a equipe pelo monitoramento; o acesso não muda sozinho. */
export async function syncDispute(id: string, ctx: Ctx) {
  const d = await stripe<Obj>("GET", `/disputes/${id}`, { expand: ["charge"] });
  const charge: Obj = typeof d.charge === "object" ? d.charge : { id: d.charge };
  const acc = await priv<string | null>("billing_record_dispute", {
    p_payment_ids: [d.payment_intent, charge.payment_intent, charge.id].filter(Boolean), p_customer_id: charge.customer ?? null,
    p_dispute_id: d.id, p_charge_id: charge.id, p_amount: d.amount, p_reason: d.reason ?? null, p_status: d.status,
    p_evidence_due_by: iso(d.evidence_details?.due_by),
  }, ctx);
  if (acc) {
    await logError("stripe-sync", ctx.cid, new Error(`contestação ${d.status}`), {
      code: d.status === "lost" ? "STRIPE_DISPUTE_LOST" : "STRIPE_DISPUTE", account_id: acc, dispute: d.id, due_by: iso(d.evidence_details?.due_by),
    });
  }
}
