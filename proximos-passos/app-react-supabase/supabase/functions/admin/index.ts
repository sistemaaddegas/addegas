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
  "overview": { action: "overview.read", run: (b, _s, c) => priv("metrics_overview", { p_month: b.month ?? null }, c) },
  "accounts/list": { action: "accounts.read", run: (b, _s, c) =>
    priv("admin_accounts", { p_staff: _s.user_id, p_filter: b.filter ?? {}, p_cursor: b.cursor ?? null, p_limit: b.limit ?? 50 }, c) },
  "accounts/detail": { action: "accounts.read", run: (b, _s, c) => priv("admin_account_detail", { p_account_id: b.account_id }, c) },
  "accounts/note": { action: "accounts.note", run: (b, st, c) =>
    priv("admin_add_note", { ...s(st), p_account_id: b.account_id, p_body: b.body }, c) },
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
    priv("admin_create_discount", { ...s(st), p_accounts: b.accounts ?? [], p_kind: b.kind, p_value: b.value,
      p_cycles: b.cycles ?? null, p_stacks: !!b.stacks, p_reason: b.reason }, c) },
  "tickets/reply": { action: "tickets.reply", run: (b, st, c) =>
    priv("staff_reply_ticket", { ...s(st), p_ticket_id: b.ticket_id, p_body: b.body, p_internal: !!b.internal, p_status: b.status ?? null }, c) },
  "catalog/save": { action: "catalog.write", run: (b, st, c) => priv("admin_catalog_save", { ...s(st), p: b.product }, c) },
  "catalog/duplicates": { action: "catalog.write", run: (_b, _s, c) => priv("admin_catalog_duplicates", {}, c) },
  "crm/lead": { action: "crm.write", run: (b, st, c) => priv("admin_lead_update", { ...s(st), p_lead_id: b.lead_id, p: b.changes }, c) },
  "messages/campaign-send": { action: "messages.send", run: (b, st, c) =>
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
    { p_user: me.id, p_aal: me.aal, p_action: def.action }, { cid, ip, userId: me.id });
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
    const inv = await serviceClient().auth.admin.inviteUserByEmail(email, { data: { full_name: b.name } });
    if (inv.error) return { ok: false, error: { code: "AUTH_ERROR", detail: inv.error.message } };
    await serviceClient().auth.admin.updateUserById(inv.data.user.id, { app_metadata: { kind: "staff" } });
    return priv("admin_staff_upsert", { ...s(st), p_user_id: inv.data.user.id, p_name: b.name, p_email: email, p_staff_role: b.role }, c);
  },
};
