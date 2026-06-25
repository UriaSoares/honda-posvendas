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
  AgendamentoDaqui1Dia?: boolean | string;
  Consultor?: string;
  Placa?: string;
  Celular?: string;
}

interface Props { store: "CGR" | "TEM" }

export default function AmanhaPanel({ store }: Props) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [last,    setLast]    = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/microwork/agendamentos");
      if (!r.ok) throw new Error("Erro ao buscar agendamentos");
      const d = await r.json();
      setAgendamentos(d.data ?? []);
      setLast(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const amanha = agendamentos.filter(a => {
    if (!a.Empresa?.toUpperCase().includes(store)) return false;
    return Number(a.AgendamentoDaqui1Dia) === 1 || a.AgendamentoDaqui1Dia === true || a.AgendamentoDaqui1Dia === "Sim";
  });

  const sorted = [...amanha].sort((a, b) =>
    (a.HoraInicioRecepcao ?? "").localeCompare(b.HoraInicioRecepcao ?? "")
  );

  const ativos     = amanha.filter(a => (a.TipoAgendamento ?? "").toUpperCase().includes("ATIVO")).length;
  const receptivos = amanha.length - ativos;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#082F58" }}>
            Agenda de Amanhã — <span style={{ color: "#FBB814" }}>{store}</span>
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

      {/* Mini KPIs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total amanhã", value: amanha.length, color: "#082F58" },
          { label: "Gerados qual.", value: ativos,       color: "#7c3aed" },
          { label: "Receptivos",   value: receptivos,   color: "#0369a1" },
        ].map(k => (
          <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
          📆 Agendamentos para amanhã ({amanha.length})
        </div>
        {sorted.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            {loading ? "Carregando..." : "Nenhum agendamento para amanhã."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Hora", "Cliente", "Modelo", "Tipo OS", "Origem", "Consultor"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((a, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#082F58", whiteSpace: "nowrap" }}>
                      {a.HoraInicioRecepcao?.slice(0, 5) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{a.Proprietario ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{a.Placa} {a.Celular ? `· ${a.Celular}` : ""}</div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#374151" }}>{a.Modelo ?? "—"}</td>
                    <td style={{ padding: "10px 14px", color: "#374151" }}>{a.TipoOS ?? "—"}</td>
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
    </div>
  );
}
