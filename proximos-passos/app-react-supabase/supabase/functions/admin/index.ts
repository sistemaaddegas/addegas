// E14 · admin-api: tudo do painel Addegas passa por aqui (/api/admin/*), no domínio admin.addegas.com.br.
// Filtro único: token válido → pessoa ativa na equipe → 2FA (aal2) → 30 min de inatividade → ação do perfil.
// Negação vai para a auditoria (private.staff_check). Cada rota abaixo declara a ação que exige.
import { clientIp, correlationId, fail, ok, preflight, readJson, subpath } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { caller, priv, serviceClient } from "../_shared/supabase.ts";

type Staff = { user_id: string; name: string; role: string; actions: string[] };
type Body = Record<string, any>;
type Handler = (b: Body, s: Staff, ctx: { cid: string; ip: string | null }) => Promise<unknown>;

const s = (staff: Staff) => ({ p_staff: staff.user_id, p_role: staff.role });

// Catálogo de rotas → ação exigida. Teste de CI: toda rota precisa estar aqui (E14).
const ROUTES: Record<string, { action: string; run: Handler }> = {
  "me": { action: "overview.read", run: async (_b, st) => st },
  // Retrato do painel: cada parte só vem se o perfil tiver a ação (private.admin_snapshot).
  "snapshot": { action: "overview.read", run: async (_b, st, c) => {
    const r = await priv<Body>("admin_snapshot", { p_staff: st.user_id }, c);
    // Fila de sugestões das adegas para o repositório (só para quem edita o catálogo).
    if (r?.ok && st.actions.includes("catalog.write")) r.data.suggestions = await priv("admin_catalog_suggestions", {}, c);
    // Contestações (chargeback) vindas do Stripe, para o Financeiro.
    if (r?.ok && st.actions.includes("billing.read")) r.data.disputes = await priv("admin_disputes", {}, c);
    return r;
  } },
  "catalog/suggestion": { action: "catalog.write", run: (b, st, c) =>
    priv("admin_catalog_suggestion", { ...s(st), p_id: b.id, p_action: b.action, p: b.data ?? {} }, c) },
  "overview": { action: "overview.read", run: (b, _s, c) => priv("metrics_overview", { p_month: b.month ?? null }, c) },
  "accounts/list": { action: "accounts.read", run: (b, _s, c) =>
    priv("admin_accounts", { p_staff: _s.user_id, p_filter: b.filter ?? {}, p_cursor: b.cursor ?? null, p_limit: b.limit ?? 50 }, c) },
  "accounts/detail": { action: "accounts.read", run: (b, _s, c) => priv("admin_account_detail", { p_account_id: b.account_id }, c) },
  "accounts/note": { action: "accounts.note", run: (b, st, c) =>
    priv("admin_note", { ...s(st), p_account_id: b.account_id, p_body: b.body }, c) },
  "accounts/plan": { action: "accounts.plan", run: (b, st, c) =>
    priv("admin_change_cycle", { ...s(st), p_account_id: b.account_id, p_cycle: b.cycle, p_activate: !!b.activate, p_reason: b.reason }, c) },
  "accounts/extend-trial": { action: "accounts.extend_trial", run: (b, st, c) =>
    priv("admin_extend_trial", { ...s(st), p_account_id: b.account_id, p_days: b.days, p_reason: b.reason }, c) },
  "accounts/access": { action: "accounts.access", run: (b, st, c) =>
    priv("admin_set_access", { ...s(st), p_account_id: b.account_id, p_access: b.access, p_reason: b.reason }, c) },
  "accounts/temp-access": { action: "accounts.temp_access", run: (b, st, c) =>
    priv("admin_temp_access", { ...s(st), p_account_id: b.account_id, p_days: b.days, p_reason: b.reason }, c) },
  "billing/manual-payment": { action: "billing.manual_payment", run: (b, st, c) =>
    priv("admin_manual_payment", { ...s(st), p_invoice_id: b.invoice_id, p_method: b.method, p_proof_path: b.proof_path, p_reason: b.reason }, c) },
  "billing/refund": { action: "billing.refund", run: (b, st, c) =>
    priv("admin_refund", { ...s(st), p_payment_id: b.payment_id, p_amount: b.amount, p_reason: b.reason }, c) },
  "billing/discount": { action: "billing.discount", run: (b, st, c) =>
    priv("admin_discount_create", { ...s(st), p_accounts: b.accounts ?? [], p_kind: b.kind, p_value: b.value,
      p_cycles: b.cycles ?? 1, p_stacks: !!b.stacks, p_starts_at: b.starts_at ?? null, p_reason: b.reason }, c) },
  "billing/discount-revoke": { action: "billing.discount", run: (b, st, c) =>
    priv("admin_revoke_discount", { ...s(st), p_discount_id: b.discount_id, p_reason: b.reason }, c) },
  "plans/price": { action: "platform.config", run: (b, st, c) =>
    priv("admin_plan_price", { ...s(st), p_cycle: b.cycle, p_price: b.price, p_reason: b.reason }, c) },
  "tickets/reply": { action: "tickets.reply", run: (b, st, c) =>
    priv("staff_reply_ticket", { ...s(st), p_ticket_id: b.ticket_id, p_body: b.body, p_internal: !!b.internal, p_status: b.status ?? null }, c) },
  "catalog/save": { action: "catalog.write", run: (b, st, c) => priv("admin_catalog_save", { ...s(st), p: b.product }, c) },
  "catalog/duplicates": { action: "catalog.write", run: (_b, _s, c) => priv("admin_catalog_duplicates", {}, c) },
  "catalog/merge": { action: "catalog.write", run: (b, st, c) => priv("admin_catalog_merge", { ...s(st), p_keep: b.keep, p_drop: b.drop }, c) },
  "catalog/update-rule": { action: "catalog.write", run: (b, st, c) =>
    priv("admin_setting_set", { ...s(st), p_key: "catalog_update_rule", p_value: { rule: b.rule === "auto" ? "auto" : "manual" } }, c) },
  "tickets/update": { action: "tickets.reply", run: (b, st, c) =>
    priv("admin_ticket_update", { ...s(st), p_ticket_id: b.ticket_id, p: b.changes ?? {} }, c) },
  "tickets/improvement": { action: "tickets.reply", run: (b, st, c) =>
    priv("admin_improvement_status", { ...s(st), p_improvement_id: b.improvement_id, p_status: b.status }, c) },
  "crm/action": { action: "crm.write", run: (b, st, c) =>
    priv("admin_lead_action", { ...s(st), p_lead_id: b.lead_id ?? null, p_action: b.action, p: b.data ?? {} }, c) },
  "crm/stages": { action: "crm.write", run: (b, st, c) =>
    priv("admin_stages_save", { ...s(st), p_names: b.names ?? {}, p_new: b.new ?? null }, c) },
  "monitor/triage": { action: "monitoring.read", run: (b, st, c) =>
    priv("admin_log_triage", { ...s(st), p_log_id: b.log_id, p_status: b.status, p_assignee: b.assignee || null, p_note: b.note ?? null }, c) },
  "monitor/alerts": { action: "monitoring.read", run: (b, st, c) =>
    priv("admin_setting_set", { ...s(st), p_key: "alerts", p_value: { items: b.alerts ?? [] } }, c) },
  "settings/set": { action: "platform.config", run: (b, st, c) =>
    priv("admin_setting_set", { ...s(st), p_key: b.key, p_value: b.value ?? {} }, c) },
  "staff/update": { action: "staff.manage", run: (b, st, c) =>
    priv("admin_staff_update", { ...s(st), p_user_id: b.user_id, p_staff_role: b.role, p_active: b.active ?? null, p_reason: b.reason }, c) },
  "messages/template": { action: "messages.send", run: (b, st, c) =>
    priv("admin_template_save", { ...s(st), p_code: b.code, p_name: b.name, p_kind: b.kind, p_body: b.body }, c) },
  // Modelo promocional exige também marketing.write: o banco confere pelo tipo do modelo (private.admin_send).
  "messages/send": { action: "messages.send", run: (b, st, c) =>
    priv("admin_send", { ...s(st), p_template: b.template, p_channels: b.channels ?? [], p_accounts: b.accounts ?? [], p_when: b.when ?? null }, c) },
  "messages/cancel": { action: "messages.send", run: (b, st, c) => priv("admin_send_cancel", { ...s(st), p_campaign_id: b.campaign_id }, c) },
  "messages/retry": { action: "messages.send", run: (b, st, c) => priv("admin_send_retry", { ...s(st), p_campaign_id: b.campaign_id }, c) },
  "marketing/spend": { action: "marketing.write", run: (b, st, c) =>
    priv("admin_marketing_spend", { ...s(st), p_channel: b.channel, p_amount: b.amount }, c) },
  "usage/funnel-create": { action: "usage.read", run: (b, st, c) =>
    priv("admin_funnel_create", { ...s(st), p_name: b.name, p_steps: b.steps ?? [] }, c) },
  "gifts/action": { action: "gifts.write", run: (b, st, c) =>
    priv("admin_gift_action", { ...s(st), p_action: b.action, p: b.data ?? {} }, c) },
  "export/log": { action: "export", run: (b, st, c) => priv("admin_log_export", { ...s(st), p_name: b.name, p_rows: b.rows ?? 0 }, c) },
  "crm/lead": { action: "crm.write", run: (b, st, c) => priv("admin_lead_update", { ...s(st), p_lead_id: b.lead_id, p: b.changes }, c) },
  // Toda campanha é promocional: só perfil com marketing (comercial ou mestre).
  "messages/campaign-send": { action: "marketing.write", run: (b, st, c) =>
    priv("campaign_send", { ...s(st), p_campaign_id: b.campaign_id }, c) },
  "usage/funnel": { action: "usage.read", run: (b, _s, c) =>
    priv("funnel_report", { p_code: b.code ?? "onboarding", p_from: b.from, p_to: b.to }, c) },
};

export const ADMIN_ROUTES = ROUTES; // usado pelo teste que confere o catálogo de ações

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cid = correlationId(req);
  const route = subpath(req, "admin");
  const def = ROUTES[route];
  if (!def) return fail(req, cid, "NOT_FOUND", 404);

  const me = await caller(req);
  if (!me || me.kind !== "staff") return fail(req, cid, "AUTH_REQUIRED", 401);
  const ip = clientIp(req);
  const check = await priv<{ ok: boolean; data?: Staff; error?: { code: string } }>("staff_check",
    { p_user: me.id, p_aal: me.aal, p_action: def.action, p_auth_at: me.mfaAt }, { cid, ip, userId: me.id });
  if (!check.ok) {
    const status = check.error!.code === "FORBIDDEN_ACTION" ? 403 : 401;
    return fail(req, cid, check.error!.code, status);
  }
  const body = (await readJson<Body>(req)) ?? {};
  try {
    const result = await def.run(body, check.data!, { cid, ip });
    // As funções private já respondem {ok, data|error}; as de leitura devolvem o dado puro.
    if (result && typeof result === "object" && "ok" in (result as Body)) {
      const r = result as Body;
      return r.ok ? ok(req, cid, r.data) : fail(req, cid, r.error.code, 422, r.error.detail ?? undefined);
    }
    return ok(req, cid, result);
  } catch (e) {
    await logError("admin", cid, e, { route, staff: me.id });
    return fail(req, cid, "INTERNAL", 500);
  }
});

// Convite de pessoa da equipe (só administrador mestre, E11): e-mail @addegas.com.br, 2FA no primeiro login.
ROUTES["staff/invite"] = {
  action: "staff.manage",
  run: async (b, st, c) => {
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!email.endsWith("@addegas.com.br")) return { ok: false, error: { code: "STAFF_EMAIL_DOMAIN" } };
    // Sem redirectTo, o link do convite cai na Site URL do Auth, que é o app da adega.
    const painel = `${(Deno.env.get("ADMIN_URL") ?? "").replace(/\/$/, "")}/`;
    const inv = await serviceClient().auth.admin.inviteUserByEmail(email, { data: { full_name: b.name }, redirectTo: painel });
    if (inv.error) return { ok: false, error: { code: "AUTH_ERROR", detail: inv.error.message } };
    await serviceClient().auth.admin.updateUserById(inv.data.user.id, { app_metadata: { kind: "staff" } });
    return priv("admin_staff_upsert", { ...s(st), p_user_id: inv.data.user.id, p_name: b.name, p_email: email, p_staff_role: b.role }, c);
  },
};
