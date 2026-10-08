import { NextRequest, NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/metas-honda-session";
import { salvarAfericao, removerAfericao, INDICADOR_IDS, hojeCG, numeroBR, type IndicadorId } from "@/lib/metas-honda";
import { lojaDaQuery } from "@/lib/loja-param";

// POST { loja, indicador, valor, data?, fonte? } — lança o número que a Honda mostra.
export async function POST(req: NextRequest) {
  const s = await sessaoAtual();
  if (!s) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  const indicador = String(b?.indicador ?? "").toUpperCase();
  const valor = numeroBR(b?.valor);
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.data ?? "")) ? String(b!.data) : hojeCG();
  if (!INDICADOR_IDS.has(indicador) || !Number.isFinite(valor))
    return NextResponse.json({ error: "Indicador ou valor inválido." }, { status: 400 });
  if (data > hojeCG())
    return NextResponse.json({ error: "Data no futuro." }, { status: 400 });

  const loja = lojaDaQuery(String(b?.loja ?? ""));
  if (s.role === "qualidade" && s.lojas.length && !s.lojas.includes(loja))
    return NextResponse.json({ error: "Sem acesso a esta loja." }, { status: 403 });

  const nova = await salvarAfericao({
    data, loja, indicador: indicador as IndicadorId, valor,
    fonte: b?.fonte === "IHS" ? "IHS" : "Tableau",
    autor: s.name || s.email,
  });
  return NextResponse.json({ ok: true, afericao: nova });
}

// DELETE ?mes=AAAA-MM&id=… — autor ou admin.
export async function DELETE(req: NextRequest) {
  const s = await sessaoAtual();
  if (!s) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const mes = req.nextUrl.searchParams.get("mes") ?? "";
  const id  = req.nextUrl.searchParams.get("id") ?? "";
  const ok = await removerAfericao(mes, id, s.name || s.email, s.role === "admin");
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Não encontrado ou sem permissão." }, { status: 404 });
}
