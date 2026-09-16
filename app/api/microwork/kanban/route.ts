import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { montarKanban } from "@/lib/kanban";

export async function GET() {
  const jar   = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ data: await montarKanban(), atualizadoEm: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
