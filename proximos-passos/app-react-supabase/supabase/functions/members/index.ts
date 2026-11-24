// E07 · Equipe da loja: o dono (ou quem tem "equipe") cria o login da pessoa (D20).
//   POST /api/members/create          {store_id, name, role, email? | username?, password?}
//   POST /api/members/reset-password  {member_id}                  (só para quem entra por nome de usuário)
//   POST /api/members/deactivate      {member_id}                  (desativa e derruba as sessões na hora, §9)
import { clientIp, correlationId, fail, ok, preflight, readJson, subpath } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { caller, priv, serviceClient, userClient } from "../_shared/supabase.ts";
import { sendEmail } from "../_shared/senders.ts";

const ROLES = ["manager", "cashier", "stock_keeper", "courier"];

// Senha provisória legível (sem caracteres ambíguos), mostrada uma vez só. Sempre com letra e número, para
// passar na regra de senha do Auth (letters_digits). Rejeição em vez de módulo: sem viés entre os caracteres.
function provisionalPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (alphabet: string) => {
    const limit = 256 - (256 % alphabet.length);
    for (;;) {
      const b = crypto.getRandomValues(new Uint8Array(1))[0];
      if (b < limit) return alphabet[b % alphabet.length];
    }
  };
  const chars = [...Array(8)].map(() => pick(letters + digits));
  chars.splice(Number(pick("0123456789")), 0, pick(letters));
  chars.splice(Number(pick("0123456789")), 0, pick(digits));
  return chars.join("");
}

// Domínios que não podem virar login de equipe de loja: o da própria Addegas (equipe interna, E11) e os técnicos.
const RESERVED_EMAIL = /@(?:[a-z0-9-]+\.)*addegas\.com\.br$|\.invalid$|\.local$|\.localhost$|\.test$|\.example$/i;
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

// Nome que vai no e-mail com a senha: só letras, números, espaço, apóstrofo e hífen, para o campo não servir de
// texto de golpe ("clique neste link") num e-mail que sai do domínio da Addegas.
const safeName = (name: string) => name.normalize("NFC").replace(/[^\p{L}\p{N} '-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);

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
      const { store_id, role } = body;
      const name = String(body.name ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
      if (!ROLES.includes(role) || !name) return fail(req, cid, "MEMBER_INVALID");
      const realEmail = String(body.email ?? "").trim().toLowerCase();
      if (realEmail && !EMAIL.test(realEmail)) return fail(req, cid, "MEMBER_LOGIN_INVALID");
      if (realEmail && RESERVED_EMAIL.test(realEmail)) return fail(req, cid, "MEMBER_EMAIL_RESERVED");
      // A permissão é conferida no banco com o token de quem pediu, antes de criar qualquer usuário.
      const check = await db.rpc("can_create_member", { p_store_id: store_id, p_role: role });
      if (check.error || !check.data?.ok) return fail(req, cid, check.data?.error?.code ?? "FORBIDDEN", 403);
      const slug = check.data.data.store_slug as string;

      const username = realEmail ? undefined : body.username?.trim().toLowerCase();
      const email = realEmail || (username ? `${username}@u.${slug}.addegas.invalid` : "");
      if (!email || (username && !/^[a-z0-9][a-z0-9._-]{2,30}$/.test(username))) return fail(req, cid, "MEMBER_LOGIN_INVALID");
      // A senha é sempre gerada aqui. Se quem cria pudesse escolher, criaria um login já confirmado com o e-mail de
      // outra pessoa e uma senha que só ele sabe (sequestro de conta antes de a dona do e-mail chegar).
      const password = provisionalPassword();

      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { kind: "person", must_change_password: true },
        user_metadata: { full_name: name },
      });
      if (created.error) return fail(req, cid, created.error.message.includes("already") ? "MEMBER_LOGIN_TAKEN" : "AUTH_ERROR", 409);

      // Até a pessoa trocar a senha, a RLS recusa tudo (E07).
      await priv("remember_provisional_password", { p_user_id: created.data.user.id }, { cid });
      const memberId = await priv<string>("attach_login_member", {
        p_actor: me.id, p_store_id: store_id, p_user_id: created.data.user.id, p_display_name: name, p_role: role,
      }, { cid, ip: clientIp(req), userId: me.id });

      // Com e-mail real, o acesso vai por e-mail; sem e-mail, a tela mostra usuário e senha uma vez (D20).
      if (realEmail) {
        const oi = safeName(name);
        await sendEmail(email, "Seu acesso ao Addegas",
          `Oi${oi ? ` ${oi}` : ""}! Seu acesso foi criado.\nUsuário: ${email}\nSenha provisória: ${password}\nTroque a senha no primeiro acesso: ${Deno.env.get("APP_URL") ?? "https://app.addegas.com.br"}`);
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
      if (check.error || !check.data?.ok) return fail(req, cid, check.data?.error?.code ?? "FORBIDDEN", 403);
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
