import { createHmac, timingSafeEqual } from "crypto";

// Cliente da WhatsApp Cloud API (Meta) — segue o padrão de lib/microwork.ts:
// token e chamadas centralizados aqui, nunca expostos ao browser.

const GRAPH = "https://graph.facebook.com";

function version(): string {
  return process.env.META_GRAPH_VERSION ?? "v21.0";
}

function getToken(): string {
  const t = process.env.WHATSAPP_SYSTEM_TOKEN;
  if (!t) throw new Error("WHATSAPP_SYSTEM_TOKEN não configurado");
  return t;
}

function getAppSecret(): string {
  const s = process.env.META_APP_SECRET;
  if (!s) throw new Error("META_APP_SECRET não configurado");
  return s;
}

async function graphPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${GRAPH}/${version()}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp API ${res.status}: ${detail}`);
  }
  return res.json();
}

export interface SendResult {
  messaging_product: string;
  messages: { id: string }[];
}

/** Envia texto livre — só permitido dentro da janela de 24h. */
export async function sendText(
  phoneNumberId: string,
  to: string,
  body: string,
): Promise<SendResult> {
  return graphPost<SendResult>(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body },
  });
}

export interface TemplateVar {
  type: "body";
  parameters: { type: "text"; text: string }[];
}

/**
 * Envia um template aprovado — usado fora da janela de 24h.
 * `vars` são os valores na ordem {{1}}, {{2}}, {{3}}...
 */
export async function sendTemplate(
  phoneNumberId: string,
  to: string,
  templateName: string,
  vars: string[],
  langCode = "pt_BR",
): Promise<SendResult> {
  const components =
    vars.length > 0
      ? [
          {
            type: "body",
            parameters: vars.map((v) => ({ type: "text", text: v })),
          },
        ]
      : [];
  return graphPost<SendResult>(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: langCode },
      components,
    },
  });
}

/** Marca uma mensagem recebida como lida (check azul) no app do cliente. */
export async function markRead(
  phoneNumberId: string,
  messageId: string,
): Promise<void> {
  await graphPost(`${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

/**
 * Valida a assinatura X-Hub-Signature-256 enviada pela Meta no webhook.
 * `rawBody` deve ser o corpo cru (string), não o JSON já parseado.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    createHmac("sha256", getAppSecret()).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
