// Log estruturado (E05): JSON no stdout das funções, com dados pessoais mascarados.
// Erros também vão para audit.system_logs via private.log (com o mesmo correlation_id).
import { priv } from "./supabase.ts";

const SENSITIVE = /(senha|password|passwd|token|secret|authorization|cookie|apikey|api_key|card|cartao|cvv|pin)/i;

export function maskEmail(value: string): string {
  return value.replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@/g, "$1***@");
}

export function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return maskEmail(value);
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? "[removido]" : redact(v)]),
    );
  }
  return value;
}

type Level = "debug" | "info" | "warn" | "error";

export function log(level: Level, fn: string, cid: string, message: string, context: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, function: fn, correlation_id: cid, message: maskEmail(message), ...redact(context) as object, at: new Date().toISOString() }));
}

// Erro de back que precisa aparecer no monitoramento (E46).
export async function logError(fn: string, cid: string, err: unknown, context: Record<string, unknown> = {}) {
  const message = err instanceof Error ? err.message : String(err);
  log("error", fn, cid, message, context);
  try {
    await priv("log", { p_source: "back", p_level: "error", p_message: `${fn}: ${message}`, p_code: (context.code as string) ?? null, p_context: context }, { cid });
  } catch (e) {
    console.error("falha ao gravar log", e);
  }
}

// Limite de taxa simples em memória por instância (o firewall da Vercel e o Supabase Auth seguram o resto, D45).
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  b.count++;
  return b.count > max;
}
