"use client";

import { useState, useEffect, useCallback } from "react";
import type { KanbanCard, Coluna } from "@/lib/kanban";

interface Props { store: "CGR" | "TEM" }

const COLUNAS: { id: Coluna; titulo: string; cor: string; janela: string }[] = [
  { id: "agendado",   titulo: "Agendado",              cor: "#0369a1", janela: "hoje" },
  { id: "aguardando", titulo: "Aguardando Serviço",    cor: "#b45309", janela: "60 dias" },
  { id: "em_servico", titulo: "Em Serviço",            cor: "#7c3aed", janela: "3 dias" },
  { id: "pausa",      titulo: "Em Pausa",              cor: "#b91c1c", janela: "60 dias" },
  { id: "preparacao", titulo: "Preparação de Entrega", cor: "#0f766e", janela: "60 dias" },
  { id: "entregue",   titulo: "Entregue",              cor: "#15803d", janela: "hoje" },
];

const REFRESH_MS = 60_000;

function diasDesde(iso: string): number {
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  const hoje = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Campo_Grande" }) + "T00:00:00");
  return Math.round((hoje.getTime() - d.getTime()) / 86400000);
}

function tempo(c: KanbanCard): { texto: string; alerta: boolean } {
  if (c.coluna === "agendado") return { texto: c.hora ? `às ${c.hora}` : "", alerta: false };
  if (c.coluna === "em_servico") return { texto: `iniciou ${c.hora}`, alerta: false };
  if (c.coluna === "entregue") return { texto: c.hora ? `concluído ${c.hora}` : "hoje", alerta: false };
  const d = diasDesde(c.desde);
  const texto = d <= 0 ? "hoje" : d === 1 ? "há 1 dia" : `há ${d} dias`;
  return { texto, alerta: d > 3 };
}

function Card({ c, cor }: { c: KanbanCard; cor: string }) {
  const t = tempo(c);
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderLeft: `4px solid ${cor}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontWeight: 800, color: "#082F58", fontSize: 14, letterSpacing: "0.5px" }}>{c.placa || "sem placa"}</span>
        {t.texto && (
          <span style={{ fontSize: 11, fontWeight: 700, color: t.alerta ? "#b91c1c" : "#64748b", whiteSpace: "nowrap" }}>{t.texto}</span>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.cliente}>{c.cliente || "—"}</div>
      {(c.modelo || c.numeroOS) && (
        <div style={{ fontSize: 11, color: "#64748b" }}>
          {c.modelo}{c.modelo && c.numeroOS ? " · " : ""}{c.numeroOS && `OS ${c.numeroOS}`}
        </div>
      )}
      {c.servicos.length > 0 && (
        <div style={{ fontSize: 11, color: "#374151" }}>{c.servicos.join(" + ")}</div>
      )}
      {c.motivo && (
        <span style={{ alignSelf: "flex-start", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "#fef2f2", color: "#b91c1c" }}>{c.motivo}</span>
      )}
      {c.tecnico && (
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          {c.coluna === "agendado" ? "Consultor: " : "🔧 "}{c.tecnico}
        </div>
      )}
    </div>
  );
}

export default function KanbanPanel({ store }: Props) {
  const [cards,   setCards]   = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [last,    setLast]    = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/microwork/kanban");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao buscar dados");
      setCards(d.data ?? []);
      setLast(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const daLoja = cards.filter(c => c.loja.includes(store));

  const motivos = new Map<string, number>();
  for (const c of daLoja) if (c.coluna === "pausa") {
    const m = c.motivo || "SEM MOTIVO";
    motivos.set(m, (motivos.get(m) ?? 0) + 1);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#082F58" }}>
            Gestão à Vista — <span style={{ color: "#FBB814" }}>{store}</span>
          </div>
          {last && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              Atualizado às {last.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · atualiza a cada minuto
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

      {motivos.size > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Motivos de pausa:</span>
          {[...motivos].sort((a, b) => b[1] - a[1]).map(([m, n]) => (
            <span key={m} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#fef2f2", color: "#b91c1c" }}>
              {m} · {n}
            </span>
          ))}
        </div>
      )}

      <div style={{ overflowX: "auto", paddingBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(220px, 1fr))", gap: 12, minWidth: 1360 }}>
          {COLUNAS.map(col => {
            const lista = daLoja
              .filter(c => c.coluna === col.id)
              .sort((a, b) => col.id === "agendado"
                ? a.hora.localeCompare(b.hora)
                : a.desde.localeCompare(b.desde));
            return (
              <div key={col.id} style={{ background: "#f1f5f9", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 260px)", minHeight: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 4px" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: col.cor }}>{col.titulo}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{col.janela}</div>
                  </div>
                  <span style={{ minWidth: 26, textAlign: "center", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 800, background: col.cor, color: "#fff" }}>
                    {lista.length}
                  </span>
                </div>
                <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {lista.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 16 }}>
                      {loading ? "Carregando..." : "Nenhuma moto"}
                    </div>
                  ) : lista.map(c => <Card key={c.id} c={c} cor={col.cor} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
