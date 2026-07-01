import { NextResponse } from "next/server";
import { getAgendamentos, getApontamentos } from "@/lib/microwork";
import { getManutencao } from "@/lib/manutencao";

// Public endpoint used by /display (TV screen) — no auth required.
// Sensitive data is minimal: names and appointment times only.
export async function GET() {
  try {
    const [ag, ap, manut] = await Promise.all([getAgendamentos(), getApontamentos(), getManutencao()]);
    return NextResponse.json({ agendamentos: ag, apontamentos: ap, precos: manut?.precos ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
