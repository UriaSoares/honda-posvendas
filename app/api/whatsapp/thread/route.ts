import { NextRequest, NextResponse } from "next/server";
import { getWaSession, resolvePhone } from "@/lib/whatsapp-auth";
import { getThread, getContact, markThreadRead, janelaAberta } from "@/lib/whatsapp-store";

export async function GET(req: NextRequest) {
  const session = await getWaSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const wa = req.nextUrl.searchParams.get("wa");
  if (!wa) return NextResponse.json({ error: "Contato não informado." }, { status: 400 });

  const requested = req.nextUrl.searchParams.get("phoneNumberId");
  const phoneNumberId = await resolvePhone(session, requested);
  if (!phoneNumberId) return NextResponse.json({ error: "Sem número conectado." }, { status: 403 });

  const [messages, contact] = await Promise.all([
    getThread(phoneNumberId, wa),
    getContact(phoneNumberId, wa),
  ]);
  await markThreadRead(phoneNumberId, wa);

  return NextResponse.json({
    messages,
    contact,
    janelaAberta: janelaAberta(contact),
  });
}
