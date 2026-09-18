import { NextRequest, NextResponse } from "next/server";
import { lerBase, lerMeta, type Compra } from "@/lib/pecas";
import { tokenValido } from "@/lib/painel-token";

// GET /api/painel/ultima-compra?negocio=honda[&tipo=atacado|varejo|todos][&desde=AAAA-MM-DD]
// Somente leitura, token fixo. Uma linha por cliente, com a compra mais recente
// (data/valor, como o painel espera) e as 3 últimas em `compras`.

export async function GET(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const negocio = (req.nextUrl.searchParams.get("negocio") ?? "honda").toLowerCase();
  if (negocio !== "honda") return NextResponse.json({ clientes: [] });

  const tipo  = (req.nextUrl.searchParams.get("tipo") ?? "atacado").toLowerCase();
  const desde = req.nextUrl.searchParams.get("desde") ?? "";

  const base = await lerBase();
  const clientes = [];

  for (const c of base.values()) {
    const compras: Compra[] =
      tipo === "varejo" ? c.varejo
      : tipo === "todos" ? [...c.atacado, ...c.varejo].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3)
      : c.atacado;
    const ultima = compras[0];
    if (!ultima) continue;
    if (desde && ultima.data < desde) continue;

    clientes.push({
      documento: c.documento,
      nome:      c.nome,
      data:      ultima.data,
      ...(ultima.valor > 0 ? { valor: ultima.valor } : {}),
      compras:   compras.map(x => ({ data: x.data, ...(x.valor > 0 ? { valor: x.valor } : {}) })),
    });
  }

  const meta = await lerMeta();
  return NextResponse.json({ clientes, atualizadoEm: meta?.ultimaSync ?? null });
}
