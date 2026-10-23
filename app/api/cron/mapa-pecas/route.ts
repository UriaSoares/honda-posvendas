import { NextRequest, NextResponse } from "next/server";
import { coletarEstoque, coletarVendas } from "@/lib/mapa-pecas";
import { dateCG } from "@/lib/microwork";

// Coleta do Mapa de Peças. Chamada pelo cron do Vercel.
//
// Estoque e faturamento vêm em chamadas separadas porque têm pesos muito
// diferentes: o relatório de obsoletos devolve ~4.800 linhas em cerca de 65 s,
// enquanto os três de venda somam menos de 10 s. Juntos estourariam o limite da
// função e, pior, uma falha no pesado derrubaria o leve junto.
//
//   ?parte=estoque   foto do estoque parado (diária, sobrescreve)
//   ?parte=vendas    faturamento dos últimos N dias (acumula por semana)
//
// A janela de 7 dias é de propósito: nota lançada com atraso reescreve a
// semana, e é assim que o ERP se comporta.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const recebido = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!segredo || recebido !== segredo)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const parte = req.nextUrl.searchParams.get("parte") ?? "vendas";
  const dias = Number(req.nextUrl.searchParams.get("dias") ?? 7);
  const inicio = new Date();

  try {
    if (parte === "estoque") {
      const resumo = await coletarEstoque();
      return NextResponse.json({ ok: true, parte, resumo, ms: Date.now() - +inicio });
    }
    if (parte === "vendas") {
      const r = await coletarVendas(dateCG(-dias), dateCG());
      return NextResponse.json({ ok: true, parte, ...r, ms: Date.now() - +inicio });
    }
    return NextResponse.json({ error: `parte desconhecida: ${parte}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e), parte }, { status: 500 });
  }
}
