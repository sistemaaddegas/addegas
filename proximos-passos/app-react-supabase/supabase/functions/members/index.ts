// E07 · Equipe da loja: o dono (ou quem tem "equipe") cria o login da pessoa (D20).
//   POST /api/members/create          {store_id, name, role, email? | username?, password?}
//   POST /api/members/reset-password  {member_id}                  (só para quem entra por nome de usuário)
//   POST /api/members/deactivate      {member_id}                  (desativa e derruba as sessões na hora, §9)
import { clientIp, correlationId, fail, ok, preflight, readJson, subpath } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { caller, priv, serviceClient, userClient } from "../_shared/supabase.ts";
import { sendEmail } from "../_shared/senders.ts";

const ROLES = ["manager", "cashier", "stock_keeper", "courier"];

// Senha provisória legível (sem caracteres ambíguos), mostrada uma vez só.
function provisionalPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cid = correlationId(req);
  const route = subpath(req, "members");
  const me = await caller(req);
  if (!me || me.kind !== "person") return fail(req, cid, "AUTH_REQUIRED", 401);
  const body = await readJson<Record<string, string>>(req);
  if (!body) return fail(req, cid, "PAYLOAD_INVALID");
  const db = userClient(req, cid);
  const admin = serviceClient();

  try {
    if (route === "create") {
      const { store_id, name, role } = body;
      if (!ROLES.includes(role) || !name?.trim()) return fail(req, cid, "MEMBER_INVALID");
      // A permissão é conferida no banco com o token de quem pediu, antes de criar qualquer usuário.
      const check = await db.rpc("can_create_member", { p_store_id: store_id, p_role: role });
      if (check.error || !check.data?.ok) return fail(req, cid, check.data?.error?.code ?? "FORBIDDEN", 403);
      const slug = check.data.data.store_slug as string;

      const username = body.username?.trim().toLowerCase();
      const email = body.email?.trim().toLowerCase() || (username ? `${username}@u.${slug}.addegas.invalid` : "");
      if (!email || (username && !/^[a-z0-9][a-z0-9._-]{2,30}$/.test(username))) return fail(req, cid, "MEMBER_LOGIN_INVALID");
      const password = body.password?.length >= 8 ? body.password : provisionalPassword();

      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { kind: "person", must_change_password: true },
        user_metadata: { full_name: name.trim() },
      });
      if (created.error) return fail(req, cid, created.error.message.includes("already") ? "MEMBER_LOGIN_TAKEN" : "AUTH_ERROR", 409);

      // Até a pessoa trocar a senha, a RLS recusa tudo (E07).
      await priv("remember_provisional_password", { p_user_id: created.data.user.id }, { cid });
      const memberId = await priv<string>("attach_login_member", {
        p_actor: me.id, p_store_id: store_id, p_user_id: created.data.user.id, p_display_name: name.trim(), p_role: role,
      }, { cid, ip: clientIp(req), userId: me.id });

      // Com e-mail real, o acesso vai por e-mail; sem e-mail, a tela mostra usuário e senha uma vez (D20).
      if (!username && body.email) {
        await sendEmail(email, "Seu acesso ao Addegas",
          `Oi ${name.trim()}! Seu acesso foi criado.\nUsuário: ${email}\nSenha provisória: ${password}\nTroque a senha no primeiro acesso: ${Deno.env.get("APP_URL") ?? "https://app.addegas.com.br"}`);
      }
      return ok(req, cid, { member_id: memberId, login: username ?? email, password: username ? password : null });
    }

    if (route === "reset-password" || route === "deactivate") {
      const { data: member } = await admin.schema("app").from("store_members").select("id, store_id, user_id, role").eq("id", body.member_id).single();
      if (!member?.user_id) return fail(req, cid, "MEMBER_NOT_FOUND", 404);

      if (route === "deactivate") {
        const res = await db.rpc("update_member", { p_member_id: member.id, p_active: false });
        if (res.error || !res.data?.ok) return fail(req, cid, res.data?.error?.code ?? "FORBIDDEN", 403);
        await admin.auth.admin.signOut(member.user_id, "global").catch(() => null);
        return ok(req, cid);
      }

      const check = await db.rpc("can_create_member", { p_store_id: member.store_id, p_role: member.role });
      if (check.error || !check.data?.ok) return fail(req, cid, "FORBIDDEN", 403);
      const { data: user } = await admin.auth.admin.getUserById(member.user_id);
      if (!user?.user?.email?.endsWith(".addegas.invalid")) return fail(req, cid, "MEMBER_HAS_EMAIL", 409, "Use a recuperação de senha por e-mail.");
      const password = provisionalPassword();
      await admin.auth.admin.updateUserById(member.user_id, {
        password, app_metadata: { ...user.user.app_metadata, must_change_password: true },
      });
      await priv("remember_provisional_password", { p_user_id: member.user_id }, { cid });
      await admin.auth.admin.signOut(member.user_id, "global").catch(() => null);
      return ok(req, cid, { password });
    }

    return fail(req, cid, "NOT_FOUND", 404);
  } catch (e) {
    await logError("members", cid, e, { route });
    return fail(req, cid, "INTERNAL", 500);
  }
});
