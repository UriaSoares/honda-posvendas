import { NextRequest, NextResponse } from "next/server";
import { sincronizarReal, sincronizarSheets } from "@/lib/metas-honda";

export const maxDuration = 60;

// Recalcula o realizado das Metas Honda (mês atual e anterior) e relê o de-para e
// as metas do Google Sheets. Chamado pelo cron do Vercel (Authorization: Bearer CRON_SECRET).
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const recebido = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!segredo || recebido !== segredo)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const sheets = await sincronizarSheets();
    const real = await sincronizarReal(2);
    return NextResponse.json({ ok: true, sheets, ...real });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
