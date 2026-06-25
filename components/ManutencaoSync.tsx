"use client";

import { useState, useEffect, useCallback } from "react";

interface PrecoModelo { modelo: string; precos: Record<string, number | null> }
interface OleoModelo { modelo: string; litragem: number | null }
interface ItemManut { item: string; obs: string; valores: Record<string, { k1000: string; k6000: string; k12000: string; aCada: string }> }
interface Extra { item: string; precoCGR: number | null; precoBAR: number | null; obs: string }
interface ManutencaoData {
  syncedAt: number;
  precos: PrecoModelo[];
  oleo: { litro: { moto: { CGR: number | null; BAR: number | null }; scooter: { CGR: number | null; BAR: number | null } }; modelos: OleoModelo[] };
  extras: Extra[];
  manut: { modelos: string[]; itens: ItemManut[] };
}

const REVISOES = ["1000", "6000", "12000", "18000", "24000", "30000"];

function money(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ManutencaoSync() {
  const [data, setData]     = useState<ManutencaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg]       = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/manutencao");
    const d = await r.json();
    setData(d.data ?? null);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function sync() {
    setSyncing(true); setMsg("");
    try {
      const r = await fetch("/api/manutencao/sync", { method: "POST" });
      const d = await r.json();
      if (r.ok) { setMsg(`✅ Sincronizado: ${d.resumo.modelosPreco} modelos, ${d.resumo.itensManut} itens.`); await load(); }
      else setMsg(`❌ ${d.error ?? "Erro ao sincronizar"}`);
    } catch (e) {
      setMsg(`❌ ${String(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Cabeçalho + ação */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Tabela de Manutenção & Preços</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Fonte: Google Sheets · {data ? `última sincronização ${new Date(data.syncedAt).toLocaleString("pt-BR")}` : "ainda não sincronizado"}
            </div>
          </div>
          <button
            onClick={sync} disabled={syncing}
            style={{
              padding: "10px 16px", background: syncing ? "#94a3b8" : "#082F58", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: syncing ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}
          >
            {syncing ? "⏳ Sincronizando..." : "↻ Sincronizar agora"}
          </button>
        </div>
        {msg && (
          <div style={{
            marginTop: 12, padding: "9px 12px", borderRadius: 8, fontSize: 12,
            background: msg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
            color: msg.startsWith("✅") ? "#15803d" : "#b91c1c",
            border: `1px solid ${msg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`,
          }}>{msg}</div>
        )}
      </div>

      {loading ? (
        <div style={{ color: "#94a3b8", fontSize: 13 }}>Carregando...</div>
      ) : !data ? (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#92400e" }}>
          Nenhum dado importado ainda. Clique em <strong>Sincronizar agora</strong> para puxar a planilha.
        </div>
      ) : (
        <>
          {/* Preços */}
          <Card title={`Preços de revisão (${data.precos.length} modelos)`}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <Th>Modelo</Th>
                    {REVISOES.map(k => <Th key={k} right>{k}</Th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.precos.map(p => (
                    <tr key={p.modelo} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "7px 12px", fontWeight: 600, color: "#0f172a" }}>{p.modelo}</td>
                      {REVISOES.map(k => (
                        <td key={k} style={{ padding: "7px 12px", textAlign: "right", color: p.precos[k] != null ? "#0f172a" : "#cbd5e1" }}>
                          {money(p.precos[k])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Óleo */}
          <Card title="Óleo — litragem e preço do litro">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <Pill label="Moto CGR"    value={money(data.oleo.litro.moto.CGR)} />
              <Pill label="Scooter CGR" value={money(data.oleo.litro.scooter.CGR)} />
              <Pill label="Moto BAR"    value={money(data.oleo.litro.moto.BAR)} />
              <Pill label="Scooter BAR" value={money(data.oleo.litro.scooter.BAR)} />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {data.oleo.modelos.map(o => (
                <span key={o.modelo} style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", color: "#475569" }}>
                  {o.modelo}: <strong>{o.litragem != null ? `${o.litragem} L` : "—"}</strong>
                </span>
              ))}
            </div>
          </Card>

          {/* Extras */}
          <Card title="Itens extras">
            {data.extras.map(e => (
              <div key={e.item} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ color: "#0f172a", fontWeight: 600 }}>{e.item}</span>
                <span style={{ color: "#64748b" }}>CGR {money(e.precoCGR)} · BAR {money(e.precoBAR)}</span>
              </div>
            ))}
          </Card>

          {/* Manutenção */}
          <Card title={`Tabela de manutenção (${data.manut.itens.length} itens · ${data.manut.modelos.length} modelos)`}>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Modelos: {data.manut.modelos.join(" · ")}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: "7px 12px", textAlign: right ? "right" : "left", fontWeight: 700, color: "#64748b", fontSize: 10, textTransform: "uppercase" }}>{children}</th>;
}
function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px" }}>
      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#082F58" }}>{value}</div>
    </div>
  );
}
