import { NextRequest, NextResponse } from "next/server";
import { getDisplayConfig } from "@/lib/display-config";

// Público — valida o PIN de 4 dígitos do telão.
export async function POST(req: NextRequest) {
  const { pin } = await req.json() as { pin?: string };
  const cfg = await getDisplayConfig();
  return NextResponse.json({ ok: (pin ?? "").trim() === cfg.pin });
}
