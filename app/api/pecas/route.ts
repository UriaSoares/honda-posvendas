import { NextRequest, NextResponse } from "next/server";
import { montarFila, montarResumo } from "@/lib/mapa-pecas-oportunidades";
import type { Loja } from "@/lib/auth/users";

// GET /api/pecas?loja=CGR          → fila de oportunidades da loja
// GET /api/pecas?visao=resumo      → números da gestão, as duas lojas
//
// Autenticação vem do middleware: /api/pecas não está em PUBLIC_PATHS, então
// só responde com sessão válida.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const visao = req.nextUrl.searchParams.get("visao") ?? "fila";
  const loja = req.nextUrl.searchParams.get("loja");

  try {
    if (visao === "resumo") return NextResponse.json(await montarResumo());
    const l = loja === "CGR" || loja === "TEM" ? (loja as Loja) : undefined;
    return NextResponse.json(await montarFila(l));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
