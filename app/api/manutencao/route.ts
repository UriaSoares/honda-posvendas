import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { getManutencao } from "@/lib/manutencao";

// GET — retorna o dataset cacheado no Redis. Qualquer usuário autenticado.
export async function GET() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const data = await getManutencao();
  return NextResponse.json({ data });
}
