import { NextResponse } from "next/server";
import { getAgendamentos, getApontamentos } from "@/lib/microwork";

// Public endpoint used by /display (TV screen) — no auth required.
// Sensitive data is minimal: names and appointment times only.
export async function GET() {
  try {
    const [ag, ap] = await Promise.all([getAgendamentos(), getApontamentos()]);
    return NextResponse.json({ agendamentos: ag, apontamentos: ap });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
