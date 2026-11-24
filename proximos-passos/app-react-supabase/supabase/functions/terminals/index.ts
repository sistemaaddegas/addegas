// E09 · Terminal do caixa.
//   POST /api/terminals/pair    {store_slug, code}   sem login: o aparelho troca o código de 6 dígitos por uma sessão
//   POST /api/terminals/revoke  {terminal_id}        dono ou gerente: revoga e apaga o usuário técnico
import { clientIp, correlationId, fail, ok, preflight, readJson, subpath } from "../_shared/http.ts";
import { logError, rateLimited } from "../_shared/log.ts";
import { caller, priv, serviceClient, userClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cid = correlationId(req);
  const route = subpath(req, "terminals");
  const body = await readJson<Record<string, string>>(req);
  if (!body) return fail(req, cid, "PAYLOAD_INVALID");
  const admin = serviceClient();
  const ip = clientIp(req);

  try {
    if (route === "pair") {
      // 10 tentativas por IP a cada 10 min: o código tem 6 dígitos e vale 10 min.
      if (rateLimited(`pair:${ip}`, 10, 600_000)) return fail(req, cid, "RATE_LIMITED", 429);
      const res = await priv<{ ok: boolean; data?: { terminal_id: string; store_id: string; name: string }; error?: { code: string } }>(
        "redeem_pairing_code", { p_store_slug: String(body.store_slug ?? ""), p_code: String(body.code ?? "") }, { cid, ip });
      if (!res.ok) return fail(req, cid, res.error!.code, 400);

      const { terminal_id, store_id, name } = res.data!;
      const email = `terminal-${terminal_id}@terminals.addegas.invalid`;
      const password = crypto.randomUUID() + crypto.randomUUID();
      const created = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        app_metadata: { kind: "terminal", store_id, terminal_id },
      });
      if (created.error) throw created.error;
      await priv("bind_terminal_user", { p_terminal_id: terminal_id, p_auth_user: created.data.user.id }, { cid, ip });

      // Sessão do aparelho: a senha técnica não é guardada em lugar nenhum; o aparelho fica com o refresh token.
      const signed = await admin.auth.signInWithPassword({ email, password });
      if (signed.error) throw signed.error;
      return ok(req, cid, {
        terminal_id, store_id, name,
        session: { access_token: signed.data.session!.access_token, refresh_token: signed.data.session!.refresh_token },
      });
    }

    if (route === "revoke") {
      const me = await caller(req);
      if (!me || me.kind !== "person") return fail(req, cid, "AUTH_REQUIRED", 401);
      const res = await userClient(req, cid).rpc("revoke_terminal", { p_terminal_id: body.terminal_id });
      if (res.error || !res.data?.ok) return fail(req, cid, res.data?.error?.code ?? "FORBIDDEN", 403);
      const authUser = res.data.data.auth_user_id as string | null;
      if (authUser) {
        await admin.auth.admin.signOut(authUser, "global").catch(() => null);
        await admin.auth.admin.deleteUser(authUser).catch(() => null);
      }
      return ok(req, cid);
    }

    return fail(req, cid, "NOT_FOUND", 404);
  } catch (e) {
    await logError("terminals", cid, e, { route });
    return fail(req, cid, "INTERNAL", 500);
  }
});
