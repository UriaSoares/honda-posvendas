import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redis } from "@/lib/redis";
import { verifySessionToken } from "@/lib/auth/session";

const KEY = "pos:promo";

export async function GET() {
  const raw = await redis.get<{ title: string; body: string; updatedAt?: string }>(KEY);
  return NextResponse.json({ promo: raw ?? { title: "", body: "" } });
}

export async function POST(req: NextRequest) {
  const jar   = await cookies();
  const token = jar.get("posvendas_session")?.value;
  const user  = token ? await verifySessionToken(token) : null;
  if (!user || (user.role !== "admin" && user.role !== "gestao")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const promo = { title: String(body.title ?? ""), body: String(body.body ?? ""), updatedAt: new Date().toISOString() };
  await redis.set(KEY, promo);
  return NextResponse.json({ ok: true, promo });
}
