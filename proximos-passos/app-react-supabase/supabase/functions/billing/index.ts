// E34 · Assinatura no Stripe (D01, D29, D54). Só o dono da conta.
//   POST /api/billing/checkout     {account_id, cycle}            cria cliente (se faltar) e a sessão do Checkout
//   POST /api/billing/portal       {account_id}                   portal do cliente (cartão, segunda via)
//   POST /api/billing/extra-stores {account_id, quantity}         lojas adicionais = item da mesma assinatura (D02)
import { correlationId, fail, ok, preflight, readJson, subpath } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { caller, priv, serviceClient } from "../_shared/supabase.ts";
import { stripe, stripeConfigured } from "../_shared/stripe.ts";

type Ctx = {
  account_id: string; account_name: string; owner_email: string; stripe_customer_id: string | null;
  stripe_subscription_id: string | null; status: string; extra_stores: number; plan_price_id: string | null;
  extra_store_price_id: string | null;
};

const APP_URL = Deno.env.get("APP_URL") ?? "https://app.addegas.com.br";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cid = correlationId(req);
  const route = subpath(req, "billing");
  const me = await caller(req);
  if (!me || me.kind !== "person") return fail(req, cid, "AUTH_REQUIRED", 401);
  const body = await readJson<Record<string, string | number>>(req);
  if (!body) return fail(req, cid, "PAYLOAD_INVALID");
  if (!stripeConfigured()) return fail(req, cid, "BILLING_NOT_CONFIGURED", 503);

  // Só o dono da conta mexe na assinatura.
  const { data: acc } = await serviceClient().schema("app").from("accounts").select("id, owner_user_id").eq("id", body.account_id).single();
  if (!acc || acc.owner_user_id !== me.id) return fail(req, cid, "FORBIDDEN", 403);

  try {
    const cycle = String(body.cycle ?? "monthly");
    if (!["monthly", "semiannual", "annual"].includes(cycle)) return fail(req, cid, "CYCLE_INVALID");
    const ctx = await priv<Ctx>("billing_checkout_context", { p_account_id: acc.id, p_cycle: cycle }, { cid, userId: me.id });

    // Cliente criado no Stripe sem cartão (o teste corre no nosso banco, §8).
    let customer = ctx.stripe_customer_id;
    if (!customer) {
      const c = await stripe<{ id: string }>("POST", "/customers", {
        email: ctx.owner_email, name: ctx.account_name, metadata: { account_id: acc.id },
      }, `customer:${acc.id}`);
      customer = c.id;
      await priv("billing_link_customer", { p_account_id: acc.id, p_customer_id: customer }, { cid });
    }

    if (route === "checkout") {
      if (!ctx.plan_price_id) return fail(req, cid, "PRICE_NOT_SYNCED", 503, "Rode o script de sincronização de preços do Stripe.");
      const items: Record<string, unknown> = { 0: { price: ctx.plan_price_id, quantity: 1 } };
      if (ctx.extra_stores > 0 && ctx.extra_store_price_id) items[1] = { price: ctx.extra_store_price_id, quantity: ctx.extra_stores };
      const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
        mode: "subscription", customer, line_items: items, locale: "pt-BR",
        success_url: `${APP_URL}/assinatura?status=ok`, cancel_url: `${APP_URL}/assinatura?status=cancelado`,
        subscription_data: { metadata: { account_id: acc.id, cycle } },
        allow_promotion_codes: true,
      });
      return ok(req, cid, { url: session.url });
    }

    if (route === "portal") {
      const portal = await stripe<{ url: string }>("POST", "/billing_portal/sessions", { customer, return_url: `${APP_URL}/assinatura` });
      return ok(req, cid, { url: portal.url });
    }

    if (route === "extra-stores") {
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 50) return fail(req, cid, "QUANTITY_INVALID");
      if (!ctx.stripe_subscription_id || !ctx.extra_store_price_id) return fail(req, cid, "SUBSCRIPTION_REQUIRED", 409);
      const sub = await stripe<{ items: { data: { id: string; price: { id: string } }[] } }>("GET", `/subscriptions/${ctx.stripe_subscription_id}`);
      const item = sub.items.data.find((i) => i.price.id === ctx.extra_store_price_id);
      // Cobrança proporcional imediata; a loja só é liberada quando o invoice.paid chegar (E08).
      await stripe("POST", `/subscriptions/${ctx.stripe_subscription_id}`, {
        items: { 0: item ? { id: item.id, quantity } : { price: ctx.extra_store_price_id, quantity } },
        proration_behavior: "always_invoice",
      }, `extra:${acc.id}:${quantity}:${Date.now()}`);
      return ok(req, cid, { requested: quantity });
    }

    return fail(req, cid, "NOT_FOUND", 404);
  } catch (e) {
    await logError("billing", cid, e, { route });
    return fail(req, cid, "BILLING_ERROR", 502);
  }
});
