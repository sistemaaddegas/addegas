// E15 · Upload com caminho decidido pelo servidor (§6) e conferência do tipo real depois do envio.
//   POST /api/uploads/sign      {purpose, store_id?, account_id?, ticket_id?, mime, size}  → {path, signed_url, token}
//   POST /api/uploads/finalize  {bucket, path, original_name?}                            → confere os primeiros bytes
import { correlationId, fail, isUuid, ok, preflight, readJson, subpath, UUID_PATTERN } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { caller, priv, serviceClient, userClient } from "../_shared/supabase.ts";

// Caminho de cada finalidade: <dono>/<sub><arquivo>, com <ticket> trocado pelo id do chamado. O /sign monta o
// caminho a partir do `sub`, e o /finalize só aceita caminho nesse mesmo formato (a regex sai do mesmo `sub`) e
// devolve o dono (loja ou conta) que está no começo dele, para conferir a permissão de novo.
const TICKET = "<ticket>";
const PURPOSES: Record<string, { bucket: string; perm: string | null; maxMb: number; mimes: string[]; scope: "store" | "account"; sub: string }> = {
  product_image: { bucket: "store-public", perm: "precos", maxMb: 2, mimes: ["image/webp", "image/jpeg", "image/png"], scope: "store", sub: "products/" },
  store_logo: { bucket: "store-public", perm: "ajustes", maxMb: 2, mimes: ["image/webp", "image/jpeg", "image/png"], scope: "store", sub: "logo-" },
  drink_image: { bucket: "store-public", perm: "ferramentas", maxMb: 2, mimes: ["image/webp", "image/jpeg", "image/png"], scope: "store", sub: "drinks/" },
  import_sheet: { bucket: "imports", perm: "precos", maxMb: 5, mimes: ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], scope: "store", sub: "import/" },
  ticket_attachment: { bucket: "ticket-attachments", perm: null, maxMb: 10, mimes: ["image/webp", "image/jpeg", "image/png", "application/pdf"], scope: "account", sub: `${TICKET}/` },
};

const EXT: Record<string, string> = {
  "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf", "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

const FILE = `${UUID_PATTERN}\\.(?:${[...new Set(Object.values(EXT))].join("|")})`;
const PATHS: Record<string, RegExp> = Object.fromEntries(Object.entries(PURPOSES).map(([k, p]) =>
  [k, new RegExp(`^(${UUID_PATTERN})/${p.sub.replace(TICKET, UUID_PATTERN)}${FILE}$`, "i")]));

/** Quem pede tem a permissão da finalidade na loja (ou é da conta, no anexo de chamado)? */
async function allowed(req: Request, cid: string, p: (typeof PURPOSES)[string], owner: string): Promise<boolean> {
  const db = userClient(req, cid);
  if (p.scope === "store") {
    const perms = await db.rpc("my_permissions", { p_store_id: owner });
    return !!perms.data?.ok && perms.data.data.permissions.includes(p.perm);
  }
  const sub = await db.rpc("my_subscription", { p_account_id: owner });
  return !!sub.data?.ok;
}

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
      // Só UUID entra no caminho: nada de "/" ou ".." vindo do corpo.
      if (!isUuid(owner) || (p.sub.includes(TICKET) && !isUuid(body.ticket_id))) return fail(req, cid, "UPLOAD_INVALID");
      // Permissão conferida com o token de quem pede.
      if (!(await allowed(req, cid, p, owner))) return fail(req, cid, "FORBIDDEN", 403);
      const path = `${owner}/${p.sub.replace(TICKET, body.ticket_id)}${crypto.randomUUID()}.${EXT[body.mime]}`;
      const signed = await admin.storage.from(p.bucket).createSignedUploadUrl(path);
      if (signed.error) throw signed.error;
      // Local: a URL sai com o host interno do Docker; PUBLIC_API_URL troca pelo endereço que o navegador alcança.
      const pub = Deno.env.get("PUBLIC_API_URL");
      const signedUrl = pub ? signed.data.signedUrl.replace(/^https?:\/\/[^/]+/, pub) : signed.data.signedUrl;
      return ok(req, cid, { bucket: p.bucket, path, signed_url: signedUrl, token: signed.data.token });
    }

    if (route === "finalize") {
      // A função lê e apaga com a chave de serviço (passa por cima das políticas do Storage). Por isso o caminho
      // tem que ter o formato da finalidade e quem pede tem que ter a mesma permissão do /sign sobre o dono dele;
      // antes, qualquer login conseguia baixar, apagar ou registrar como seu o arquivo de outra adega.
      const purpose = String(body.purpose ?? "");
      const p = PURPOSES[purpose];
      const path = String(body.path ?? "");
      const owner = p ? PATHS[purpose].exec(path)?.[1] : undefined;
      if (!p || (body.bucket && body.bucket !== p.bucket) || !owner) return fail(req, cid, "UPLOAD_INVALID");
      if (!(await allowed(req, cid, p, owner))) return fail(req, cid, "FORBIDDEN", 403);
      const bucket = p.bucket;
      const file = await admin.storage.from(bucket).download(path);
      if (file.error) return fail(req, cid, "UPLOAD_NOT_FOUND", 404);
      const bytes = new Uint8Array(await file.data.arrayBuffer());
      const real = sniff(bytes);
      if (!real || !p.mimes.includes(real) || bytes.length > p.maxMb * 1024 * 1024) {
        await admin.storage.from(bucket).remove([path]);
        return fail(req, cid, "UPLOAD_TYPE_REJECTED", 415);
      }
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      await priv("register_file", {
        p_bucket: bucket, p_path: path, p_size: bytes.length, p_mime: real, p_sha256: sha,
        p_original_name: typeof body.original_name === "string" ? body.original_name.replace(/[\u0000-\u001f\u007f/\\]/g, "").slice(0, 120) : null,
        p_uploaded_by: me.id,
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
