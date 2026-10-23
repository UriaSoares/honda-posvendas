import { NextRequest, NextResponse } from "next/server";
import { montarFicha } from "@/lib/mapa-pecas-oportunidades";

// GET /api/pecas/ficha?cod=12391KRM840
// A ficha é o que o balcão mais usa: onde a peça está, quanto gira e a que
// preço saiu. Busca por código normalizado, então aceita com ou sem traço.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cod = req.nextUrl.searchParams.get("cod") ?? "";
  if (!cod.trim()) return NextResponse.json({ error: "Informe o código." }, { status: 400 });

  try {
    const ficha = await montarFicha(cod);
    if (!ficha) return NextResponse.json({ error: "Peça não encontrada no estoque nem nas vendas recentes." }, { status: 404 });
    return NextResponse.json(ficha);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
