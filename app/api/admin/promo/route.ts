import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session";
import { getPromo, savePromo, slotAtual, type PromoConfig } from "@/lib/promo";
import { lojaDaQuery } from "@/lib/loja-param";

// GET público (usado pelo telão) — devolve os slots da loja + qual está no ar.
export async function GET(req: NextRequest) {
  const loja = lojaDaQuery(req.nextUrl.searchParams.get("loja"));
  const cfg = await getPromo(loja);
  return NextResponse.json({ promo: cfg, atual: slotAtual(cfg), loja });
}

export async function POST(req: NextRequest) {
  const jar   = await cookies();
  const token = jar.get("posvendas_session")?.value;
  const user  = token ? await verifySessionToken(token) : null;
  if (!user || (user.role !== "admin" && user.role !== "gestao")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const body = await req.json() as PromoConfig & { loja?: string };
  const loja = lojaDaQuery(body.loja);
  const slots = (body.slots ?? []).slice(0, 4).map(s => ({
    titulo: String(s.titulo ?? ""),
    texto:  String(s.texto ?? ""),
    imagem: String(s.imagem ?? ""),
    upload: !!s.upload,
  }));
  await savePromo(loja, { slots });
  return NextResponse.json({ ok: true });
}
