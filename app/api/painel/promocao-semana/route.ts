import { NextRequest, NextResponse } from "next/server";
import { getPromoAtacado, noAr } from "@/lib/promo-atacado";
import { tokenValido } from "@/lib/painel-token";
import { dateCG } from "@/lib/microwork";
import type { Loja } from "@/lib/auth/users";

// GET /api/painel/promocao-semana?negocio=honda[&loja=CGR]
// Somente leitura, token fixo. Devolve só o que está NO AR hoje.
// O id é estável por loja+slot, para a cópia do painel ser idempotente.

export async function GET(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const negocio = (req.nextUrl.searchParams.get("negocio") ?? "honda").toLowerCase();
  if (negocio !== "honda") return NextResponse.json({ promocoes: [] });

  const pedida = (req.nextUrl.searchParams.get("loja") ?? "").toUpperCase();
  const lojas: Loja[] = pedida === "CGR" || pedida === "TEM" ? [pedida as Loja] : ["CGR", "TEM"];
  const hoje = dateCG();
  const origem = req.nextUrl.origin;

  interface PromocaoSaida {
    id: string; loja: Loja; titulo: string; descricao: string;
    imagemUrl: string; inicio: string; fim: string; textos: string[];
  }
  const promocoes: PromocaoSaida[] = [];
  for (const loja of lojas) {
    const { slots } = await getPromoAtacado(loja);
    slots.forEach((s, i) => {
      if (!noAr(s, hoje)) return;
      promocoes.push({
        id:        `${loja.toLowerCase()}-slot-${i + 1}`,
        loja,
        titulo:    s.titulo,
        descricao: s.descricao,
        imagemUrl: s.upload ? `${origem}/api/painel/promo-img/${loja}/${i}` : s.imagem,
        inicio:    s.inicio,
        fim:       s.fim,
        textos:    s.textos.filter(t => t.trim()),
      });
    });
  }

  return NextResponse.json({ promocoes });
}
