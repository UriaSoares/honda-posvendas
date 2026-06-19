import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { getOrdensServico } from "@/lib/microwork";

export async function GET() {
  const jar   = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const session = await verifySessionToken(token);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const data = await getOrdensServico();
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
