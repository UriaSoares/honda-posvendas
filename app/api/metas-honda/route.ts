import { NextRequest, NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/metas-honda-session";
import { lerReal, lerMetas, lerAfericoes, lerSheetsMeta, lerDePara, mesAtual, hojeCG } from "@/lib/metas-honda";

// GET ?mes=AAAA-MM — realizado (agregado), metas, aferições e de-para do mês.
export async function GET(req: NextRequest) {
  const s = await sessaoAtual();
  if (!s) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("mes") ?? "";
  const mes = /^\d{4}-\d{2}$/.test(q) ? q : mesAtual();
  const [real, metas, afericoes, sheets, depara] = await Promise.all([
    lerReal(mes), lerMetas(mes), lerAfericoes(mes), lerSheetsMeta(), lerDePara(),
  ]);
  return NextResponse.json({ mes, hoje: hojeCG(), real, metas, afericoes, sheets, depara });
}
