import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/metas-honda-session";
import { getComprasRaw, resolverCampos, normalizarLinhas, hojeCG } from "@/lib/metas-honda";

export const maxDuration = 60;

// Diagnóstico (admin): chaves cruas do relatório 295 e como foram mapeadas.
// Usar no primeiro deploy para conferir o mapeamento; pode ser removida depois.
export async function GET() {
  const s = await sessaoAtual();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const hoje = hojeCG();
  try {
    const raw = await getComprasRaw(`${hoje.slice(0, 7)}-01`, hoje);
    const chaves = raw[0] ? Object.keys(raw[0]) : [];
    let amostraNormalizada: unknown = null, erro: string | null = null;
    try { amostraNormalizada = normalizarLinhas(raw.slice(0, 3)); } catch (e) { erro = String(e); }
    return NextResponse.json({ total: raw.length, chaves, mapeamento: resolverCampos(chaves), amostraCrua: raw[0] ?? null, amostraNormalizada, erro });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
