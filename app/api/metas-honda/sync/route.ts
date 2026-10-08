import { NextRequest, NextResponse } from "next/server";
import { sessaoAtual, podeSincronizar } from "@/lib/metas-honda-session";
import { sincronizarReal, sincronizarSheets, sincronizarMes } from "@/lib/metas-honda";

export const maxDuration = 60;

// POST — "Sincronizar agora" (admin/gestão). Body opcional { mes: "AAAA-MM" } para
// recalcular um mês fechado; sem body, recalcula o atual e o anterior.
export async function POST(req: NextRequest) {
  const s = await sessaoAtual();
  if (!s || !podeSincronizar(s)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { mes?: string };
  try {
    const sheets = await sincronizarSheets();
    if (body.mes && /^\d{4}-\d{2}$/.test(body.mes)) {
      const r = await sincronizarMes(body.mes);
      return NextResponse.json({ ok: true, sheets, meses: [body.mes], ...r });
    }
    const r = await sincronizarReal(2);
    return NextResponse.json({ ok: true, sheets, ...r });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
