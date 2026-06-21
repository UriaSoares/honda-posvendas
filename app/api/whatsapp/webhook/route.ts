import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/whatsapp";
import { getEmailByPhone, recordIncoming, type WaMessage } from "@/lib/whatsapp-store";

// Webhook público chamado pela Meta. Está em PUBLIC_PATHS no middleware.
// GET  → handshake de verificação.
// POST → recebe mensagens e status; valida assinatura antes de processar.

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface MetaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}
interface MetaValue {
  metadata?: { phone_number_id?: string };
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: MetaMessage[];
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(raw, sig)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: { entry?: { changes?: { value?: MetaValue }[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // só processa se este número estiver vinculado a um atendente
        const owner = await getEmailByPhone(phoneNumberId);
        if (!owner) continue;

        const nameByWa = new Map<string, string>();
        for (const c of value?.contacts ?? []) {
          if (c.wa_id) nameByWa.set(c.wa_id, c.profile?.name ?? c.wa_id);
        }

        for (const m of value?.messages ?? []) {
          if (m.type !== "text" || !m.text) continue; // v1: só texto
          const msg: WaMessage = {
            id:        m.id,
            direction: "in",
            type:      "text",
            body:      m.text.body,
            timestamp: Number(m.timestamp) * 1000 || Date.now(),
          };
          await recordIncoming(phoneNumberId, m.from, nameByWa.get(m.from) ?? m.from, msg);
        }
      }
    }
  } catch (e) {
    // nunca devolver 500 para a Meta evita reentregas em loop; logamos e seguimos
    console.error("webhook processing error", e);
  }

  return NextResponse.json({ received: true });
}
