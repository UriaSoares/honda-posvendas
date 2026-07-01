import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/session";
import { getPromo, savePromo, slotAtual, type PromoConfig } from "@/lib/promo";

// GET público (usado pelo telão) — devolve os slots + qual está no ar.
export async function GET() {
  const cfg = await getPromo();
  return NextResponse.json({ promo: cfg, atual: slotAtual(cfg) });
}

export async function POST(req: NextRequest) {
  const jar   = await cookies();
  const token = jar.get("posvendas_session")?.value;
  const user  = token ? await verifySessionToken(token) : null;
  if (!user || (user.role !== "admin" && user.role !== "gestao")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const body = await req.json() as PromoConfig;
  const slots = (body.slots ?? []).slice(0, 4).map(s => ({
    titulo: String(s.titulo ?? ""),
    texto:  String(s.texto ?? ""),
    imagem: String(s.imagem ?? ""),
    upload: !!s.upload,
  }));
  await savePromo({ slots });
  return NextResponse.json({ ok: true });
}
