import { NextRequest, NextResponse } from "next/server";
import { getPromoImg } from "@/lib/promo";

// Público — serve a imagem enviada de um slot de promoção.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slot: string }> }) {
  const { slot } = await ctx.params;
  const i = Number(slot);
  if (isNaN(i) || i < 0 || i > 3) return new NextResponse("Not found", { status: 404 });

  const dataUrl = await getPromoImg(i);
  if (!dataUrl) return new NextResponse("Not found", { status: 404 });

  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(5, comma); // ex: image/png;base64
  const mime = header.split(";")[0];
  if (!mime.startsWith("image/")) return new NextResponse("Bad image", { status: 500 });

  const buf = Buffer.from(dataUrl.slice(comma + 1), "base64");
  return new NextResponse(buf, {
    headers: { "Content-Type": mime, "Cache-Control": "public, max-age=60" },
  });
}
