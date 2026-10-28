// E15 · Upload com caminho decidido pelo servidor (§6) e conferência do tipo real depois do envio.
//   POST /api/uploads/sign      {purpose, store_id?, account_id?, ticket_id?, mime, size}  → {path, signed_url, token}
//   POST /api/uploads/finalize  {bucket, path, original_name?}                            → confere os primeiros bytes
import { correlationId, fail, ok, preflight, readJson, subpath } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { caller, priv, serviceClient, userClient } from "../_shared/supabase.ts";

const PURPOSES: Record<string, { bucket: string; perm: string | null; maxMb: number; mimes: string[]; scope: "store" | "account" }> = {
  product_image: { bucket: "store-public", perm: "precos", maxMb: 2, mimes: ["image/webp", "image/jpeg", "image/png"], scope: "store" },
  store_logo: { bucket: "store-public", perm: "ajustes", maxMb: 2, mimes: ["image/webp", "image/jpeg", "image/png"], scope: "store" },
  drink_image: { bucket: "store-public", perm: "ferramentas", maxMb: 2, mimes: ["image/webp", "image/jpeg", "image/png"], scope: "store" },
  import_sheet: { bucket: "imports", perm: "precos", maxMb: 5, mimes: ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], scope: "store" },
  ticket_attachment: { bucket: "ticket-attachments", perm: null, maxMb: 10, mimes: ["image/webp", "image/jpeg", "image/png", "application/pdf"], scope: "account" },
};

const EXT: Record<string, string> = {
  "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf", "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

// Assinatura dos primeiros bytes de cada tipo aceito.
function sniff(bytes: Uint8Array): string | null {
  const h = [...bytes.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (h.startsWith("ffd8ff")) return "image/jpeg";
  if (h.startsWith("89504e47")) return "image/png";
  if (h.startsWith("52494646") && h.slice(16, 24) === "57454250") return "image/webp";
  if (h.startsWith("25504446")) return "application/pdf";
  if (h.startsWith("504b0304")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (bytes.slice(0, 64).every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128)) return "text/csv";
  return null;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cid = correlationId(req);
  const route = subpath(req, "uploads");
  const me = await caller(req);
  if (!me || me.kind !== "person") return fail(req, cid, "AUTH_REQUIRED", 401);
  const body = await readJson<Record<string, any>>(req);
  if (!body) return fail(req, cid, "PAYLOAD_INVALID");
  const admin = serviceClient();

  try {
    if (route === "sign") {
      const p = PURPOSES[body.purpose];
      if (!p || !p.mimes.includes(body.mime) || !(Number(body.size) > 0) || Number(body.size) > p.maxMb * 1024 * 1024) {
        return fail(req, cid, "UPLOAD_INVALID");
      }
      const owner = p.scope === "store" ? body.store_id : body.account_id;
      // Permissão conferida com o token de quem pede.
      const db = userClient(req, cid);
      if (p.scope === "store") {
        const perms = await db.rpc("my_permissions", { p_store_id: owner });
        if (!perms.data?.ok || !perms.data.data.permissions.includes(p.perm)) return fail(req, cid, "FORBIDDEN", 403);
      } else {
        const sub = await db.rpc("my_subscription", { p_account_id: owner });
        if (!sub.data?.ok) return fail(req, cid, "FORBIDDEN", 403);
      }
      const name = `${crypto.randomUUID()}.${EXT[body.mime]}`;
      const path = body.purpose === "ticket_attachment" ? `${owner}/${body.ticket_id}/${name}`
        : body.purpose === "store_logo" ? `${owner}/logo-${name}`
        : `${owner}/${body.purpose.replace("_image", "s").replace("_sheet", "")}/${name}`;
      const signed = await admin.storage.from(p.bucket).createSignedUploadUrl(path);
      if (signed.error) throw signed.error;
      // Local: a URL sai com o host interno do Docker; PUBLIC_API_URL troca pelo endereço que o navegador alcança.
      const pub = Deno.env.get("PUBLIC_API_URL");
      const signedUrl = pub ? signed.data.signedUrl.replace(/^https?:\/\/[^/]+/, pub) : signed.data.signedUrl;
      return ok(req, cid, { bucket: p.bucket, path, signed_url: signedUrl, token: signed.data.token });
    }

    if (route === "finalize") {
      const { bucket, path } = body as { bucket: string; path: string };
      const p = Object.values(PURPOSES).find((x) => x.bucket === bucket);
      if (!p) return fail(req, cid, "UPLOAD_INVALID");
      const file = await admin.storage.from(bucket).download(path);
      if (file.error) return fail(req, cid, "UPLOAD_NOT_FOUND", 404);
      const bytes = new Uint8Array(await file.data.arrayBuffer());
      const real = sniff(bytes);
      if (!real || !p.mimes.includes(real)) {
        await admin.storage.from(bucket).remove([path]);
        return fail(req, cid, "UPLOAD_TYPE_REJECTED", 415);
      }
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      await priv("register_file", {
        p_bucket: bucket, p_path: path, p_size: bytes.length, p_mime: real, p_sha256: sha,
        p_original_name: body.original_name ?? null, p_uploaded_by: me.id,
      }, { cid, userId: me.id });
      return ok(req, cid, { path, mime: real, size: bytes.length,
        public_url: bucket === "store-public" ? admin.storage.from(bucket).getPublicUrl(path).data.publicUrl : null });
    }

    return fail(req, cid, "NOT_FOUND", 404);
  } catch (e) {
    await logError("uploads", cid, e, { route });
    return fail(req, cid, "INTERNAL", 500);
  }
});
