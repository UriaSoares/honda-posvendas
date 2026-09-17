import { NextRequest, NextResponse } from "next/server";
import { getPromoAtacadoImg } from "@/lib/promo-atacado";
import { lojaDaQuery } from "@/lib/loja-param";

// Público — serve a arte da promoção do atacado. É só a peça de campanha, a
// mesma que vai para o cliente; o painel guarda esta URL no card.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ loja: string; slot: string }> }) {
  const { loja, slot } = await ctx.params;
  const i = Number(slot);
  if (isNaN(i) || i < 0 || i > 3) return new NextResponse("Not found", { status: 404 });

  const dataUrl = await getPromoAtacadoImg(lojaDaQuery(loja), i);
  if (!dataUrl) return new NextResponse("Not found", { status: 404 });

  const comma = dataUrl.indexOf(",");
  const mime = dataUrl.slice(5, comma).split(";")[0];
  if (!mime.startsWith("image/")) return new NextResponse("Bad image", { status: 500 });

  return new NextResponse(Buffer.from(dataUrl.slice(comma + 1), "base64"), {
    headers: { "Content-Type": mime, "Cache-Control": "public, max-age=300" },
  });
}
