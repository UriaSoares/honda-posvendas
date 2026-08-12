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

  // Valores distintos de Situacao / TipoAgendamento (pós-mapeamento) com contagem.
  try {
    const ag = await getAgendamentos();
    const count = (field: "Situacao" | "TipoAgendamento") => {
      const m = new Map<string, number>();
      for (const a of ag) {
        const v = (a[field] ?? "").toString() || "(vazio)";
        m.set(v, (m.get(v) ?? 0) + 1);
      }
      return Object.fromEntries(m);
    };
    out.distintos = {
      Situacao: count("Situacao"),
      TipoAgendamento: count("TipoAgendamento"),
    };
    const diego = ag.filter(a => (a.Proprietario ?? "").toUpperCase().includes("DIEGO ALEJANDRO"));
    out.diegoAlejandro = diego;
  } catch (e) {
    out.distintosErro = String(e);
  }

  return NextResponse.json(out);
}
