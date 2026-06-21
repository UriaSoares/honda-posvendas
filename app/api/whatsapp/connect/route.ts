import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { linkAttendant, getAttendant, getAllAttendants } from "@/lib/whatsapp-store";

async function getSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// GET — status da conexão. Atendente vê o seu; gestor/admin vê todos.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  if (session.role === "admin" || session.role === "gestao") {
    const all = await getAllAttendants();
    const mine = await getAttendant(session.email);
    return NextResponse.json({ mine, all });
  }
  const mine = await getAttendant(session.email);
  return NextResponse.json({ mine, all: mine ? [mine] : [] });
}

// POST — grava o vínculo do número (retorno do Embedded Signup de Coexistência).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { phoneNumberId, wabaId, displayNumber } = await req.json() as {
    phoneNumberId?: string;
    wabaId?: string;
    displayNumber?: string;
  };
  if (!phoneNumberId || !wabaId)
    return NextResponse.json({ error: "Dados de conexão incompletos." }, { status: 400 });

  await linkAttendant({
    email:         session.email,
    phoneNumberId,
    wabaId,
    displayNumber: displayNumber ?? "",
    status:        "connected",
    connectedAt:   Date.now(),
  });

  return NextResponse.json({ ok: true });
}
