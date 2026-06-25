import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { getAgendamentos, getApontamentos, getOrdensServico } from "@/lib/microwork";

// Rota TEMPORÁRIA de diagnóstico — revela o formato cru da resposta do Microwork
// (shape + chaves reais do 1º registro). Admin only. Remover depois de mapear.
export async function GET() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  function inspect(v: unknown) {
    if (Array.isArray(v)) {
      return { tipo: "array", total: v.length, chaves: v[0] ? Object.keys(v[0]) : [], amostra: v[0] ?? null };
    }
    return { tipo: typeof v, valor: v };
  }

  const out: Record<string, unknown> = {};
  for (const [nome, fn] of [
    ["agendamentos", getAgendamentos],
    ["apontamentos", getApontamentos],
    ["os", getOrdensServico],
  ] as const) {
    try {
      out[nome] = inspect(await fn());
    } catch (e) {
      out[nome] = { erro: String(e) };
    }
  }
  return NextResponse.json(out);
}
