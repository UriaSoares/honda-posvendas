import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session";
import { setPromoAtacadoImg } from "@/lib/promo-atacado";
import { lojaDaQuery } from "@/lib/loja-param";

// POST { slot, dataUrl, loja } — arte da promoção do atacado. admin/gestao.
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get("posvendas_session")?.value;
  const user = token ? await verifySessionToken(token) : null;
  if (!user || (user.role !== "admin" && user.role !== "gestao"))
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { slot, dataUrl, loja } = await req.json() as { slot?: number; dataUrl?: string; loja?: string };
  if (typeof slot !== "number" || slot < 0 || slot > 3 || !dataUrl?.startsWith("data:image/"))
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  if (dataUrl.length > 1_300_000)
    return NextResponse.json({ error: "Imagem muito grande (máx ~1MB). Otimize antes de enviar." }, { status: 413 });

  await setPromoAtacadoImg(lojaDaQuery(loja), slot, dataUrl);
  return NextResponse.json({ ok: true });
}
