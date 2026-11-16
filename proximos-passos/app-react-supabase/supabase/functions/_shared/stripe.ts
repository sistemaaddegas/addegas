// Stripe por fetch (E34): chamadas da API e verificação de assinatura do webhook com WebCrypto.

const API = "https://api.stripe.com/v1";
/**
 * Versão da API fixada em todas as chamadas e no endpoint do webhook (scripts/stripe-sync.mjs). Conta nova do
 * Stripe nasce na versão mais recente, que mudou de lugar campos que o sistema usa (período da assinatura,
 * pagamento da fatura); fixando, o formato não muda sem a gente decidir.
 */
export const STRIPE_API_VERSION = "2024-06-20";

function form(data: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(data).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) return [];
    if (typeof v === "object") return form(v as Record<string, unknown>, key);
    return [`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`];
  });
}

export function stripeConfigured(): boolean {
  return !!Deno.env.get("STRIPE_SECRET_KEY");
}

export async function stripe<T = Record<string, unknown>>(method: "GET" | "POST", path: string, data?: Record<string, unknown>,
  idempotencyKey?: string): Promise<T> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada");
  const body = data ? form(data).join("&") : undefined;
  const res = await fetch(method === "GET" && body ? `${API}${path}?${body}` : `${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(20_000), // Stripe lento não prende a tela: vira BILLING_ERROR
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`stripe ${path}: ${json?.error?.message ?? res.status}`);
  return json as T;
}

// Cabeçalho Stripe-Signature: t=<timestamp>,v1=<hmac sha256 de "<t>.<corpo>">. Tolerância de 5 min (§7).
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const signatures = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((s) => timingSafeEqual(s, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
