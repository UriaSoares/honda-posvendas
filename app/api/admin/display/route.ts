import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { getDisplayConfig, saveDisplayConfig, type DisplayConfig } from "@/lib/display-config";

async function guard() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const s = token ? await verifySessionToken(token) : null;
  return s && (s.role === "admin" || s.role === "gestao") ? s : null;
}

// GET — config completa (com PIN) para o painel ADM.
export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  return NextResponse.json({ config: await getDisplayConfig() });
}

// POST — salva a config do telão.
export async function POST(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const cfg = await req.json() as DisplayConfig;

  const pin = (cfg.pin ?? "").trim();
  if (!/^\d{1,4}$/.test(pin))
    return NextResponse.json({ error: "PIN deve ter até 4 dígitos numéricos." }, { status: 400 });

  await saveDisplayConfig(cfg);
  return NextResponse.json({ ok: true });
}
