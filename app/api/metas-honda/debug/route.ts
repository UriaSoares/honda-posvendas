import { NextRequest, NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/metas-honda-session";
import {
  getComprasRaw, resolverCampos, normalizarLinhas,
  getOSRaw, resolverCamposOS, normalizarOS, agregarPassagens, hojeCG,
} from "@/lib/metas-honda";

export const maxDuration = 60;

// Diagnóstico (admin): chaves cruas de um relatório e como foram mapeadas.
//   /api/metas-honda/debug          → compras (relatório 295)
//   /api/metas-honda/debug?fonte=os → OS / passagens (relatório 190)
export async function GET(req: NextRequest) {
  const s = await sessaoAtual();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const hoje = hojeCG();
  const inicio = `${hoje.slice(0, 7)}-01`;
  const os = req.nextUrl.searchParams.get("fonte") === "os";
  try {
    const raw = os ? await getOSRaw(inicio, hoje) : await getComprasRaw(inicio, hoje);
    const chaves = raw[0] ? Object.keys(raw[0]) : [];
    let amostraNormalizada: unknown = null, resumo: unknown = null, erro: string | null = null;
    try {
      if (os) {
        const linhas = normalizarOS(raw);
        amostraNormalizada = linhas.slice(0, 3);
        resumo = agregarPassagens(linhas, hoje.slice(0, 7));
      } else {
        amostraNormalizada = normalizarLinhas(raw.slice(0, 3));
      }
    } catch (e) { erro = String(e); }
    return NextResponse.json({
      fonte: os ? "os (190)" : "compras (295)", total: raw.length, chaves,
      mapeamento: os ? resolverCamposOS(chaves) : resolverCampos(chaves),
      amostraCrua: raw[0] ?? null, amostraNormalizada, resumo, erro,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
