// Acesso ao banco e ao Auth pelas funções. A chave de serviço e a conexão direta nunca saem daqui (§7).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.50.0";
import postgres from "npm:postgres@3.4.5";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Conexão direta ao Postgres para as funções private.* (o schema private não é exposto na API REST, E03).
// prepare: false porque em produção a conexão passa pelo pooler em modo transação (§9).
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3, idle_timeout: 20 });

// Cliente com a chave de serviço: usado só para o Auth (criar usuário, derrubar sessões) e o Storage.
export function serviceClient(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Age como o usuário da requisição: a RLS e as RPCs do app conferem as permissões dele.
export function userClient(req: Request, cid: string): SupabaseClient {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "app" },
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
        "x-correlation-id": cid,
        "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      },
    },
  });
}

export type Caller = { id: string; email: string | null; kind: string | null; aal: string | null };

// Usuário da requisição, confirmado no Auth. O aal (2FA) vem do token.
export async function caller(req: Request): Promise<Caller | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) return null;
  const claims = decodeJwt(token);
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    kind: (data.user.app_metadata?.kind as string) ?? null,
    aal: (claims?.aal as string) ?? null,
  };
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=")));
  } catch {
    return null;
  }
}

type Ctx = { cid?: string; ip?: string | null; userId?: string | null };

function call(fn: string, args: Record<string, unknown>, setof: boolean) {
  if (!/^[a-z_][a-z0-9_]*$/.test(fn) || Object.keys(args).some((k) => !/^p(_[a-z0-9_]+)?$/.test(k))) {
    throw new Error(`chamada inválida: ${fn}`);
  }
  const keys = Object.keys(args);
  const params = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
  const query = setof ? `select * from private.${fn}(${params})` : `select private.${fn}(${params}) as r`;
  // O driver converte objetos para jsonb e arrays para arrays do Postgres; não serializar aqui.
  const values = keys.map((k) => args[k] ?? null);
  return { query, values };
}

// Roda numa transação com o contexto da requisição (correlation_id, IP e usuário), para logs e auditoria.
async function run<T>(ctx: Ctx, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return await sql.begin(async (tx) => {
    await tx.unsafe(
      "select set_config('request.headers', $1, true), set_config('request.jwt.claims', $2, true)",
      [
        JSON.stringify({ "x-correlation-id": ctx.cid ?? null, "x-forwarded-for": ctx.ip ?? null }),
        JSON.stringify(ctx.userId ? { sub: ctx.userId, role: "service_role" } : { role: "service_role" }),
      ],
    );
    return await fn(tx);
  }) as T;
}

// Função private.* que devolve um valor (jsonb, int, void...).
export async function priv<T = unknown>(fn: string, args: Record<string, unknown> = {}, ctx: Ctx = {}): Promise<T> {
  const { query, values } = call(fn, args, false);
  return await run(ctx, async (tx) => (await tx.unsafe(query, values as never[]))[0]?.r as T);
}

// Função private.* que devolve linhas (setof).
export async function privRows<T = Record<string, unknown>>(fn: string, args: Record<string, unknown> = {}, ctx: Ctx = {}): Promise<T[]> {
  const { query, values } = call(fn, args, true);
  return await run(ctx, async (tx) => (await tx.unsafe(query, values as never[])) as unknown as T[]);
}
