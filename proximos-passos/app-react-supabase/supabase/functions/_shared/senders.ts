// Envio de e-mail (Resend, E35) e WhatsApp (W-API, E45) por fetch, sem SDK.
// Com EMAIL_ENABLED/WHATSAPP_ENABLED diferente de "true", nada sai: só fica no log (ambiente de desenvolvimento).

export type SendResult = { ok: boolean; providerId?: string; error?: string };

export async function sendEmail(to: string, subject: string, text: string, replyTo?: string): Promise<SendResult> {
  if (Deno.env.get("EMAIL_ENABLED") !== "true") {
    console.log(JSON.stringify({ level: "info", message: "e-mail não enviado (EMAIL_ENABLED off)", subject }));
    return { ok: true, providerId: "dry-run" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("EMAIL_FROM") ?? "Addegas <naoresponda@mail.addegas.com.br>",
      to: [to],
      subject,
      text,
      reply_to: replyTo,
    }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, providerId: body.id } : { ok: false, error: `${res.status} ${JSON.stringify(body)}` };
}

// W-API: instância e token por ambiente. O formato do endpoint segue a documentação da W-API e fica em
// variável (WAPI_SEND_URL) para não prender o código a uma versão da API deles.
export async function sendWhatsApp(phone: string, text: string): Promise<SendResult> {
  if (Deno.env.get("WHATSAPP_ENABLED") !== "true") {
    console.log(JSON.stringify({ level: "info", message: "WhatsApp não enviado (WHATSAPP_ENABLED off)" }));
    return { ok: true, providerId: "dry-run" };
  }
  const url = Deno.env.get("WAPI_SEND_URL");
  if (!url) return { ok: false, error: "WAPI_SEND_URL não configurada" };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("WAPI_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message: text }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, providerId: body.messageId ?? body.id } : { ok: false, error: `${res.status} ${JSON.stringify(body)}` };
}
