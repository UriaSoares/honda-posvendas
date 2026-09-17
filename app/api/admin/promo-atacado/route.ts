import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session";
import { getPromoAtacado, savePromoAtacado, noAr, type PromoAtacadoConfig } from "@/lib/promo-atacado";
import { lojaDaQuery } from "@/lib/loja-param";
import { dateCG } from "@/lib/microwork";

async function gestor() {
  const jar = await cookies();
  const token = jar.get("posvendas_session")?.value;
  const user = token ? await verifySessionToken(token) : null;
  return user && (user.role === "admin" || user.role === "gestao") ? user : null;
}

export async function GET(req: NextRequest) {
  if (!await gestor()) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const loja = lojaDaQuery(req.nextUrl.searchParams.get("loja"));
  const cfg = await getPromoAtacado(loja);
  const hoje = dateCG();
  return NextResponse.json({ promo: cfg, noAr: cfg.slots.map(s => noAr(s, hoje)), loja });
}

export async function POST(req: NextRequest) {
  if (!await gestor()) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const body = await req.json() as PromoAtacadoConfig & { loja?: string };
  await savePromoAtacado(lojaDaQuery(body.loja), { slots: body.slots ?? [] });
  return NextResponse.json({ ok: true });
}
