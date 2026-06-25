import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { syncManutencao } from "@/lib/manutencao";

// POST — força a sincronização Sheets → Redis. admin/gestao.
export async function POST() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session || (session.role !== "admin" && session.role !== "gestao"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  try {
    const data = await syncManutencao();
    return NextResponse.json({
      ok: true,
      syncedAt: data.syncedAt,
      resumo: {
        modelosPreco: data.precos.length,
        modelosOleo:  data.oleo.modelos.length,
        itensManut:   data.manut.itens.length,
        extras:       data.extras.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
