"use client";

import { useState, useEffect, useCallback } from "react";

interface OS {
  Empresa?: string;
  NumeroOS?: string;
  Proprietario?: string;
  Modelo?: string;
  Situacao?: string;
  DataEmissao?: string;
  Placa?: string;
  Chassi?: string;
  Quilometragem?: number;
  [key: string]: unknown;
}

interface Apontamento {
  Empresa?: string;
  Tecnico?: string;
  NumeroOS?: number | null;
  Placa?: string;
  Servico?: string;
  SituacaoApontamento?: string;
  SituacaoServicoItem?: string;
  HorasApontadas?: number;
  HorasPrevistas?: number;
  [key: string]: unknown;
}

interface Props { store: "CGR" | "TEM" }

const OS_RULES: { match: string; bg: string; color: string }[] = [
  { match: "ANDAMENTO", bg: "#fef9c3", color: "#854d0e" },
  { match: "PRONTO",    bg: "#dcfce7", color: "#15803d" },
  { match: "FINALIZ",   bg: "#dcfce7", color: "#15803d" },
  { match: "CONCLU",    bg: "#dcfce7", color: "#15803d" },
  { match: "AGUARD",    bg: "#fee2e2", color: "#b91c1c" },
  { match: "ABERT",     bg: "#e0f2fe", color: "#0369a1" },
];

function SitBadge({ sit }: { sit: string }) {
  const k = (sit ?? "").toUpperCase();
  const c = OS_RULES.find(r => k.includes(r.match)) ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
      {sit || "—"}
    </span>
  );
}

export default function OficinaPanel({ store }: Props) {
  const [oss, setOss]         = useState<OS[]>([]);
  const [apont, setApont]     = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [last,    setLast]    = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [ro, ra] = await Promise.all([
        fetch("/api/microwork/os"),
        fetch("/api/microwork/apontamentos"),
      ]);
      if (!ro.ok || !ra.ok) throw new Error("Erro ao buscar dados");
      const [dos, dap] = await Promise.all([ro.json(), ra.json()]);
      setOss(dos.data ?? []);
      setApont(dap.data ?? []);
      setLast(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const inStore = (e?: string) => (e ?? "").toUpperCase().includes(store);
  const filtOss   = oss.filter(o => inStore(o.Empresa));
  const filtApont = apont.filter(a => inStore(a.Empresa));

  const isAberto  = (a: Apontamento) => (a.SituacaoApontamento ?? "").toUpperCase() === "ABERTO";
  const isFechado = (a: Apontamento) => (a.SituacaoApontamento ?? "").toUpperCase() === "FECHADO";

  // apontamentos com serviço real (têm OS) — ignora linhas ociosas
  const comServico = filtApont.filter(a => a.NumeroOS || (a.Servico ?? "").trim());

  const emServico = comServico.filter(isAberto).length;
  const prontos   = comServico.filter(isFechado).length;

  // técnicos: todos os presentes (agrupa por nome)
  const tecMap = filtApont.reduce((m, a) => {
    const t = a.Tecnico ?? "Sem técnico";
    if (!m.has(t)) m.set(t, []);
    m.get(t)!.push(a);
    return m;
  }, new Map<string, Apontamento[]>());

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#082F58" }}>
            Oficina ao Vivo — <span style={{ color: "#FBB814" }}>{store}</span>
          </div>
          {last && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              Atualizado às {last.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "8px 14px", background: loading ? "#e2e8f0" : "#082F58", color: loading ? "#94a3b8" : "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {loading ? "⏳ Buscando..." : "↻ Atualizar"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "OSs no dia",      value: filtOss.length, color: "#082F58" },
          { label: "Em serviço",      value: emServico,      color: "#d97706" },
          { label: "Prontos",         value: prontos,        color: "#16a34a" },
          { label: "Técnicos",        value: tecMap.size,    color: "#7c3aed" },
        ].map(k => (
          <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        {/* OSs table */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            🗂️ Ordens de Serviço do dia ({filtOss.length})
          </div>
          {filtOss.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              {loading ? "Carregando..." : "Nenhuma OS no momento."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["OS", "Cliente / Modelo", "Placa", "Km", "Pass.", "Status"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtOss.map((o, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: "#082F58" }}>{o.NumeroOS || "—"}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{o.Proprietario || "—"}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{o.Modelo}</div>
                      </td>
                      <td style={{ padding: "9px 12px", color: "#374151" }}>{o.Placa || "—"}</td>
                      <td style={{ padding: "9px 12px", color: "#374151", whiteSpace: "nowrap" }}>{o.Quilometragem ? o.Quilometragem.toLocaleString("pt-BR") : "—"}</td>
                      <td style={{ padding: "9px 12px", color: "#64748b" }}>{typeof o.qtdepassagem === "number" ? String(o.qtdepassagem) : "—"}</td>
                      <td style={{ padding: "9px 12px" }}><SitBadge sit={o.Situacao ?? ""} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Técnicos */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            👨‍🔧 Técnicos ao vivo ({tecMap.size})
          </div>
          {tecMap.size === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              {loading ? "Carregando..." : "Nenhum apontamento."}
            </div>
          ) : (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from(tecMap.entries()).map(([tec, aps]) => {
                const ativoAp = aps.find(isAberto);
                const horas = aps.reduce((s, a) => s + (a.HorasApontadas ?? 0), 0);
                const prev  = aps.reduce((s, a) => s + (a.HorasPrevistas ?? 0), 0);
                const pct   = prev > 0 ? Math.min(100, Math.round((horas / prev) * 100)) : 0;
                return (
                  <div key={tec} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: ativoAp ? "#16a34a" : "#cbd5e1" }} />
                        <span style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{tec}</span>
                      </div>
                      <span style={{ fontSize: 10, color: "#64748b" }}>{prev > 0 ? `${pct}%` : "ocioso"}</span>
                    </div>
                    {ativoAp ? (
                      <div style={{ fontSize: 11, color: "#0f172a" }}>
                        🔧 {ativoAp.Servico || "Serviço"} {ativoAp.Placa ? `· ${ativoAp.Placa}` : ""}
                        <span style={{ color: "#94a3b8" }}> · OS {ativoAp.NumeroOS}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>Sem serviço em andamento</div>
                    )}
                    {prev > 0 && (
                      <div style={{ background: "#f1f5f9", borderRadius: 99, height: 5, overflow: "hidden", marginTop: 6 }}>
                        <div style={{ height: "100%", borderRadius: 99, background: pct >= 80 ? "#16a34a" : pct >= 50 ? "#FBB814" : "#082F58", width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
