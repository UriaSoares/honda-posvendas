"use client";

import { useState, useEffect, useCallback } from "react";

interface OS {
  Empresa?: string;
  NumeroOS?: string;
  Proprietario?: string;
  Modelo?: string;
  Consultor?: string;
  Tecnico?: string;
  TipoOS?: string;
  Situacao?: string;
  DataEmissao?: string;
  PrevisaoEntrega?: string;
  ValorOS?: number;
  Placa?: string;
}

interface Apontamento {
  Empresa?: string;
  Tecnico?: string;
  OS?: string;
  Operacao?: string;
  Situacao?: string;
  HorasApontadas?: number;
  HorasPrevistas?: number;
  Inicio?: string;
}

interface Props { store: "CGR" | "TEM" }

const SIT_BADGE: Record<string, { bg: string; color: string }> = {
  "ABERTA":          { bg: "#e0f2fe", color: "#0369a1" },
  "EM ANDAMENTO":    { bg: "#fef9c3", color: "#854d0e" },
  "AGUARDANDO PECA": { bg: "#fee2e2", color: "#b91c1c" },
  "AGUARDANDO PEÇA": { bg: "#fee2e2", color: "#b91c1c" },
  "CONCLUIDA":       { bg: "#dcfce7", color: "#15803d" },
  "CONCLUÍDA":       { bg: "#dcfce7", color: "#15803d" },
};

function SitBadge({ sit }: { sit: string }) {
  const k = (sit ?? "").toUpperCase();
  const c = Object.entries(SIT_BADGE).find(([key]) => k.includes(key))?.[1] ?? { bg: "#f1f5f9", color: "#64748b" };
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

  const filtOss  = oss.filter(o  => o.Empresa?.toUpperCase().includes(store));
  const filtApont = apont.filter(a => a.Empresa?.toUpperCase().includes(store));

  // Group apontamentos by tecnico
  const tecMap = filtApont.reduce((m, a) => {
    const t = a.Tecnico ?? "Sem técnico";
    if (!m.has(t)) m.set(t, []);
    m.get(t)!.push(a);
    return m;
  }, new Map<string, Apontamento[]>());

  const abertas    = filtOss.filter(o => !(o.Situacao ?? "").toUpperCase().includes("CONCLU")).length;
  const concluidas = filtOss.filter(o => (o.Situacao ?? "").toUpperCase().includes("CONCLU")).length;
  const aguardando = filtOss.filter(o => (o.Situacao ?? "").toUpperCase().includes("AGUARD")).length;

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
        <button
          onClick={fetchData} disabled={loading}
          style={{
            padding: "8px 14px", background: loading ? "#e2e8f0" : "#082F58",
            color: loading ? "#94a3b8" : "#fff", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}
        >
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
          { label: "OSs abertas",    value: abertas,    color: "#0369a1" },
          { label: "Concluídas",     value: concluidas, color: "#16a34a" },
          { label: "Aguard. peça",   value: aguardando, color: "#b91c1c" },
          { label: "Técnicos ativos",value: tecMap.size, color: "#7c3aed" },
        ].map(k => (
          <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* OSs table */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            🗂️ Ordens de Serviço ({filtOss.length})
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
                    {["OS", "Cliente / Modelo", "Técnico", "Tipo", "Status", "Prev. Entrega"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtOss.map((o, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: "#082F58" }}>{o.NumeroOS ?? "—"}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{o.Proprietario ?? "—"}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{o.Modelo} {o.Placa ? `· ${o.Placa}` : ""}</div>
                      </td>
                      <td style={{ padding: "9px 12px", color: "#374151" }}>{o.Tecnico ?? "—"}</td>
                      <td style={{ padding: "9px 12px", color: "#374151", whiteSpace: "nowrap" }}>{o.TipoOS ?? "—"}</td>
                      <td style={{ padding: "9px 12px" }}><SitBadge sit={o.Situacao ?? ""} /></td>
                      <td style={{ padding: "9px 12px", color: "#64748b", whiteSpace: "nowrap" }}>
                        {o.PrevisaoEntrega ? o.PrevisaoEntrega.slice(0, 10) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Técnicos sidebar */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            👨‍🔧 Técnicos ({tecMap.size})
          </div>
          {tecMap.size === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              {loading ? "Carregando..." : "Nenhum apontamento."}
            </div>
          ) : (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from(tecMap.entries()).map(([tec, aps]) => {
                const horas = aps.reduce((s, a) => s + (a.HorasApontadas ?? 0), 0);
                const prev  = aps.reduce((s, a) => s + (a.HorasPrevistas ?? 0), 0);
                const pct   = prev > 0 ? Math.min(100, Math.round((horas / prev) * 100)) : 0;
                const ativo = aps.some(a => (a.Situacao ?? "").toUpperCase().includes("ABERTO") || (a.Situacao ?? "").toUpperCase().includes("ANDAMENTO"));
                return (
                  <div key={tec} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: ativo ? "#16a34a" : "#94a3b8",
                        }} />
                        <span style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{tec}</span>
                      </div>
                      <span style={{ fontSize: 10, color: "#64748b" }}>{aps.length} OS</span>
                    </div>
                    <div style={{ background: "#f1f5f9", borderRadius: 99, height: 5, overflow: "hidden", marginBottom: 5 }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        background: pct >= 80 ? "#16a34a" : pct >= 50 ? "#FBB814" : "#082F58",
                        width: `${pct}%`,
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>
                      {horas.toFixed(1)}h apontadas · {pct}% capacidade
                    </div>
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
