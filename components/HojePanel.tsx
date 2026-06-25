"use client";

import { useState, useEffect, useCallback } from "react";

interface Agendamento {
  Empresa?: string;
  Proprietario?: string;
  Modelo?: string;
  HoraInicioRecepcao?: string;
  TipoOS?: string;
  Situacao?: string;
  TipoAgendamento?: string;
  AgendamentoHoje?: boolean | string;
  Consultor?: string;
  Placa?: string;
  Celular?: string;
}

interface Apontamento {
  Empresa?: string;
  Tecnico?: string;
  OS?: string;
  Operacao?: string;
  Inicio?: string;
  Termino?: string;
  Situacao?: string;
  Modelo?: string;
  HorasApontadas?: number;
  HorasPrevistas?: number;
}

interface Props { store: "CGR" | "TEM" }

const STATUS_RULES: { match: string; bg: string; color: string; label: string }[] = [
  { match: "BAIXAD",     bg: "#f0fdf4", color: "#166534", label: "Baixado" },
  { match: "ABERTO",     bg: "#e0f2fe", color: "#0369a1", label: "Aguardando" },
  { match: "REAGEND",    bg: "#fef9c3", color: "#854d0e", label: "Reagendado" },
  { match: "COMPARECEU", bg: "#fef2f2", color: "#b91c1c", label: "Não veio" },
  { match: "CANCEL",     bg: "#fef2f2", color: "#b91c1c", label: "Cancelado" },
];

function badge(status: string) {
  const up = (status ?? "").toUpperCase();
  const s = STATUS_RULES.find(r => up.includes(r.match)) ?? { bg: "#f1f5f9", color: "#64748b", label: status || "—" };
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
      padding: "16px 18px", flex: 1, minWidth: 110,
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default function HojePanel({ store }: Props) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ra, rp] = await Promise.all([
        fetch("/api/microwork/agendamentos"),
        fetch("/api/microwork/apontamentos"),
      ]);
      if (!ra.ok || !rp.ok) throw new Error("Erro ao buscar dados");
      const [da, dp] = await Promise.all([ra.json(), rp.json()]);
      setAgendamentos(da.data ?? []);
      setApontamentos(dp.data ?? []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isToday = (a: Agendamento) =>
    Number(a.AgendamentoHoje) === 1 || a.AgendamentoHoje === true || a.AgendamentoHoje === "Sim";

  const ag = agendamentos.filter(a =>
    a.Empresa?.toUpperCase().includes(store) && isToday(a)
  );

  const ap = apontamentos.filter(a => a.Empresa?.toUpperCase().includes(store));

  const sit = (a: Agendamento) => (a.Situacao ?? "").toUpperCase();

  const agendados   = ag.length;
  const baixados    = ag.filter(a => sit(a).includes("BAIXAD")).length;                       // sucesso
  const aguardando  = ag.filter(a => sit(a).includes("ABERTO")).length;                       // ainda não chegou
  const reagendados = ag.filter(a => sit(a).includes("REAGEND")).length;
  const perdas      = ag.filter(a => sit(a).includes("COMPARECEU") || sit(a).includes("CANCEL")).length;
  const ativos      = ag.filter(a => (a.TipoAgendamento ?? "").toUpperCase().includes("ATIVO")).length;

  const tecnicos = Array.from(
    ap.reduce((m, a) => {
      const t = a.Tecnico ?? "Técnico";
      if (!m.has(t)) m.set(t, { name: t, oss: [], horas: 0, horasPrev: 0 });
      const entry = m.get(t)!;
      entry.oss.push(a.OS ?? "");
      entry.horas += a.HorasApontadas ?? 0;
      entry.horasPrev += a.HorasPrevistas ?? 0;
      return m;
    }, new Map<string, { name: string; oss: string[]; horas: number; horasPrev: number }>())
  ).map(([, v]) => v).sort((a, b) => b.horas - a.horas);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#082F58" }}>
            Agenda de Hoje — <span style={{ color: "#FBB814" }}>{store}</span>
          </div>
          {lastRefresh && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              Atualizado às {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
        <button
          onClick={fetchData} disabled={loading}
          style={{
            padding: "8px 14px", background: loading ? "#e2e8f0" : "#082F58", color: loading ? "#94a3b8" : "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
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
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KpiCard label="Agendados"     value={agendados}   icon="📅" color="#082F58" />
        <KpiCard label="Baixados"      value={baixados}    icon="✅" color="#16a34a" />
        <KpiCard label="Aguardando"    value={aguardando}  icon="⏳" color="#0369a1" />
        <KpiCard label="Reagendados"   value={reagendados} icon="🔁" color="#d97706" />
        <KpiCard label="Perdas"        value={perdas}      icon="❌" color="#dc2626" />
        <KpiCard label="Gerados qual." value={ativos}      icon="📞" color="#7c3aed" />
      </div>

      {/* Agenda */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
          📋 Agenda do dia ({ag.length})
        </div>
        {ag.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            {loading ? "Carregando agendamentos..." : "Nenhum agendamento para hoje."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Hora", "Cliente", "Modelo", "Tipo OS", "Status", "Origem", "Consultor"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ag
                  .sort((a, b) => (a.HoraInicioRecepcao ?? "").localeCompare(b.HoraInicioRecepcao ?? ""))
                  .map((a, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#082F58", whiteSpace: "nowrap" }}>
                        {a.HoraInicioRecepcao?.slice(0, 5) ?? "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{a.Proprietario ?? "—"}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{a.Placa} {a.Celular ? `· ${a.Celular}` : ""}</div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#374151" }}>{a.Modelo ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#374151", whiteSpace: "nowrap" }}>{a.TipoOS ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{badge(a.Situacao ?? "")}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: (a.TipoAgendamento ?? "").toUpperCase().includes("ATIVO") ? "#f3e8ff" : "#e0f2fe",
                          color:      (a.TipoAgendamento ?? "").toUpperCase().includes("ATIVO") ? "#7c3aed" : "#0369a1",
                        }}>
                          {(a.TipoAgendamento ?? "RECEPTIVO").toUpperCase().includes("ATIVO") ? "ATIVO" : "RECEPTIVO"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>{a.Consultor ?? "—"}</td>
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
          🔧 Técnicos ao vivo ({tecnicos.length})
        </div>
        {tecnicos.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            {loading ? "Carregando apontamentos..." : "Nenhum apontamento no momento."}
          </div>
        ) : (
          <div style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {tecnicos.map(t => {
              const pct = t.horasPrev > 0 ? Math.min(100, Math.round((t.horas / t.horasPrev) * 100)) : 0;
              return (
                <div key={t.name} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{t.name}</div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {t.horas.toFixed(1)}h / {t.horasPrev.toFixed(1)}h
                    </span>
                  </div>
                  <div style={{ background: "#f1f5f9", borderRadius: 99, height: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 99,
                      background: pct >= 80 ? "#16a34a" : pct >= 50 ? "#FBB814" : "#082F58",
                      width: `${pct}%`, transition: "width 0.4s",
                    }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
                    {t.oss.filter(Boolean).length} OS · {pct}% capacidade
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
