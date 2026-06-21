import { NextRequest, NextResponse } from "next/server";
import { getWaSession, resolvePhone } from "@/lib/whatsapp-auth";
import { getInbox } from "@/lib/whatsapp-store";

export async function GET(req: NextRequest) {
  const session = await getWaSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const requested = req.nextUrl.searchParams.get("phoneNumberId");
  const phoneNumberId = await resolvePhone(session, requested);
  if (!phoneNumberId) return NextResponse.json({ inbox: [], phoneNumberId: null });

  const inbox = await getInbox(phoneNumberId);
  return NextResponse.json({ inbox, phoneNumberId });
}
