import { NextRequest, NextResponse } from "next/server";
import { sincronizarPecas } from "@/lib/pecas";
import { dateCG } from "@/lib/microwork";

export const maxDuration = 60;

// Sincroniza as vendas de peças dos últimos dias. Chamado pelo cron do Vercel
// (Authorization: Bearer CRON_SECRET). A janela cobre notas lançadas com atraso.
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const recebido = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!segredo || recebido !== segredo)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const dias = Number(req.nextUrl.searchParams.get("dias") ?? 7);
  try {
    const r = await sincronizarPecas(dateCG(-dias), dateCG());
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
