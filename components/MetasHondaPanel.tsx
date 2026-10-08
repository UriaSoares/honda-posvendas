"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  INDICADORES, internoParaAfericao, diasUteis,
  type IndicadorDef, type IndicadorId, type RealMes, type Meta, type Afericao, type Agregado,
} from "@/lib/metas-honda-model";
import type { Role } from "@/lib/auth/users";

interface Props { store: "CGR" | "TEM"; role: Role }

interface Payload {
  mes: string;
  hoje: string;
  real: RealMes | null;
  metas: Meta[];
  afericoes: Afericao[];
  sheets: { sincronizadoEm: string; depara: string; metas: string; erros: string[] } | null;
}

const NAVY = "#082F58", GOLD = "#FBB814";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 };

function fmt(v: number | null | undefined, u: IndicadorDef["unidade"]): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (u === "R$") return v >= 10000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  if (u === "%") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (u === "nota") return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const n = v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  return u === "L" ? `${n} L` : n;
}
const pct = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

function corDe(ratio: number | null): string {
  if (ratio == null) return "#94a3b8";
  if (ratio >= 1) return "#16a34a";
  if (ratio >= 0.85) return "#d97706";
  return "#dc2626";
}

function mesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function somaMes(mes: string, d: number): string {
  const [y, m] = mes.split("-").map(Number);
  const x = new Date(y, m - 1 + d, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

interface Linha {
  def:        IndicadorDef;
  meta:       number | null;
  real:       number | null;   // interno (automático) ou último Honda (manual)
  agregado?:  Agregado;
  honda:      Afericao | null; // aferição mais recente
  internoNaData: number | null;
  desvio:     number | null;   // interno / honda - 1
  ratio:      number | null;   // real / meta
  projecao:   number | null;
  faltaDia:   number | null;
}

export default function MetasHondaPanel({ store, role }: Props) {
  const [mes, setMes]         = useState<string>("");
  const [data, setData]       = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError]     = useState("");
  const [aviso, setAviso]     = useState("");
  const [sel, setSel]         = useState<IndicadorId>("PV");
  const [form, setForm]       = useState({ indicador: "PV" as IndicadorId, valor: "", data: "", fonte: "IHS" as "IHS" | "Tableau" });
  const podeSync = role === "admin" || role === "gestao";

  const aplicar = useCallback((d: Payload) => {
    setData(d);
    setMes(d.mes);
    setForm(f => ({ ...f, data: f.data || d.hoje }));
  }, []);

  const carregar = useCallback(async (m?: string) => {
    setLoading(true); setError("");
    try {
      aplicar(await buscar(m));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [aplicar]);

  useEffect(() => {
    let vivo = true;
    buscar()
      .then(d => { if (vivo) aplicar(d); })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : "Erro desconhecido"); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [aplicar]);

  async function sincronizar() {
    setSyncing(true); setError(""); setAviso("");
    try {
      const atual = data?.hoje.slice(0, 7);
      const body = mes && atual && mes < somaMes(atual, -1) ? { mes } : {};
      const r = await fetch("/api/metas-honda/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Falha na sincronização");
      const extras = [...(d.sheets?.erros ?? []), ...(d.avisos ?? [])];
      setAviso(`Sincronizado: ${d.linhas} linhas de compra e ${d.os ?? 0} linhas de OS (${(d.meses ?? []).join(", ")}).${extras.length ? " Avisos: " + extras.join(" ") : ""}`);
      await carregar(mes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSyncing(false);
    }
  }

  async function lancar(e: React.FormEvent) {
    e.preventDefault(); setError(""); setAviso("");
    const r = await fetch("/api/metas-honda/afericao", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, loja: store }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? "Erro ao lançar"); return; }
    setForm(f => ({ ...f, valor: "" }));
    setAviso("Aferição lançada.");
    await carregar(form.data.slice(0, 7) === mes ? mes : form.data.slice(0, 7));
  }

  async function remover(a: Afericao) {
    const r = await fetch(`/api/metas-honda/afericao?mes=${a.data.slice(0, 7)}&id=${a.id}`, { method: "DELETE" });
    if (r.ok) await carregar(mes);
  }

  const linhas: Linha[] = useMemo(() => {
    if (!data) return [];
    const ag = data.real?.lojas?.[store] ?? {};
    const atual = data.hoje.slice(0, 7);
    const diaHoje = Number(data.hoje.slice(8, 10));
    const duMes = diasUteis(data.mes);
    const duAte = data.mes === atual ? diasUteis(data.mes, diaHoje) : data.mes < atual ? duMes : 0;
    const duRestantes = Math.max(duMes - duAte, 0);

    return INDICADORES.map(def => {
      const meta = data.metas.find(m => m.loja === store && m.indicador === def.id)?.meta ?? null;
      const afs = data.afericoes.filter(a => a.loja === store && a.indicador === def.id)
        .sort((a, b) => (b.data + b.criadoEm).localeCompare(a.data + a.criadoEm));
      const honda = afs[0] ?? null;
      const agregado = ag[def.id];
      const real = def.automatico ? (agregado?.total ?? (data.real ? 0 : null)) : (honda?.valor ?? null);
      const internoNaData = def.automatico && honda ? internoParaAfericao(def, agregado, Number(honda.data.slice(8, 10))).valor : null;
      const desvio = internoNaData != null && honda && honda.valor ? internoNaData / honda.valor - 1 : null;
      const ratio = meta && real != null ? real / meta : null;
      const somaveis = def.unidade !== "nota" && def.unidade !== "%";
      const projecao = def.automatico && somaveis && real != null && duAte > 0 ? (real / duAte) * duMes : null;
      const faltaDia = def.automatico && meta && real != null && duRestantes > 0 ? Math.max(meta - real, 0) / duRestantes : null;
      return { def, meta, real, agregado, honda, internoNaData, desvio, ratio, projecao, faltaDia };
    });
  }, [data, store]);

  const detalhe = linhas.find(l => l.def.id === sel);
  const afsDetalhe = (data?.afericoes ?? []).filter(a => a.loja === store && a.indicador === sel).sort((a, b) => b.data.localeCompare(a.data));
  const naoMap = (data?.real?.naoMapeados ?? []).filter(n => n.loja === store);
  const avisos = data?.real?.avisos ?? [];

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>
            Metas Honda — <span style={{ color: GOLD }}>{store}</span>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            {data?.real ? `Microwork sincronizado em ${new Date(data.real.atualizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : "Ainda sem sincronização para este mês"}
            {data?.sheets && ` · de-para: ${data.sheets.depara === "sheets" ? "Sheets" : "padrão"} · metas: ${data.sheets.metas === "sheets" ? "Sheets" : "padrão"}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => carregar(somaMes(mes, -1))} disabled={loading || !mes} style={btnSec}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, minWidth: 130, textAlign: "center", textTransform: "capitalize" }}>{mes ? mesLabel(mes) : "…"}</span>
          <button onClick={() => carregar(somaMes(mes, 1))} disabled={loading || !mes || mes >= (data?.hoje.slice(0, 7) ?? "")} style={btnSec}>›</button>
          {podeSync && (
            <button onClick={sincronizar} disabled={syncing} style={{ ...btnPri, background: syncing ? "#e2e8f0" : NAVY, color: syncing ? "#94a3b8" : "#fff" }}>
              {syncing ? "⏳ Sincronizando..." : "↻ Sincronizar agora"}
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ ...msg, background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }}>{error}</div>}
      {aviso && <div style={{ ...msg, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>{aviso}</div>}
      {loading && !data && <div style={{ color: "#64748b", fontSize: 13 }}>Carregando...</div>}

      {/* Cards — mesma ordem do Tableau */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 190px), 1fr))", gap: 12, marginBottom: 20 }}>
        {linhas.map(l => {
          const ativo = sel === l.def.id;
          return (
            <button key={l.def.id} onClick={() => { setSel(l.def.id); setForm(f => ({ ...f, indicador: l.def.id, fonte: l.def.id === "PV" ? "IHS" : "Tableau" })); }}
              style={{ ...card, padding: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit", borderColor: ativo ? NAVY : "#e2e8f0", boxShadow: ativo ? `0 0 0 2px ${NAVY}22` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: 0.3 }}>{l.def.nome}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: l.def.automatico ? "#0369a1" : "#94a3b8" }}>{l.def.automatico ? "AUTO" : "HONDA"}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: corDe(l.ratio), margin: "6px 0 2px" }}>{pct(l.ratio)}</div>
              <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${Math.min((l.ratio ?? 0) * 100, 100)}%`, height: "100%", background: corDe(l.ratio) }} />
              </div>
              <Row k="Real" v={fmt(l.real, l.def.unidade)} />
              <Row k="Meta" v={fmt(l.meta, l.def.unidade)} />
              {l.projecao != null && <Row k="Projeção" v={fmt(l.projecao, l.def.unidade)} cor={corDe(l.meta ? l.projecao / l.meta : null)} />}
              {l.faltaDia != null && l.faltaDia > 0 && <Row k="Falta/dia útil" v={fmt(l.faltaDia, l.def.unidade)} />}
              {l.def.automatico && l.honda && (
                <Row k={`Honda ${l.honda.data.slice(8, 10)}/${l.honda.data.slice(5, 7)}`} v={`${fmt(l.honda.valor, l.def.unidade)}${l.desvio != null ? ` (${l.desvio >= 0 ? "+" : ""}${pct(l.desvio)})` : ""}`}
                  cor={l.desvio != null && Math.abs(l.desvio) > 0.05 ? "#dc2626" : "#64748b"} />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
        {/* Detalhe do indicador */}
        <div style={{ ...card, padding: 16 }}>
          {detalhe && (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{detalhe.def.nome}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>{REGRA[detalhe.def.id]}</div>
              {detalhe.def.automatico && detalhe.agregado ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
                  <Quebra titulo={detalhe.def.id === "PV" ? "Conta na meta (tipo de pedido)" : detalhe.def.id === "PASSAGENS" ? "OS por tipo" : "Conta na meta"} dados={detalhe.agregado.porGrupo} u={detalhe.def.unidade} cor="#16a34a" />
                  <Quebra titulo={detalhe.def.id === "PV" ? "Comprado e fora da meta" : detalhe.def.id === "PASSAGENS" ? "Canceladas" : "Comprado e não conta"} dados={detalhe.agregado.foraPorGrupo} u={detalhe.def.unidade} cor="#94a3b8" />
                </div>
              ) : detalhe.def.automatico ? (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>Nenhuma compra deste indicador no mês.</div>
              ) : (
                <div style={{ fontSize: 13, color: "#64748b" }}>Indicador ainda manual: o real é o último número lançado da Honda.</div>
              )}
              {detalhe.def.id === "PASSAGENS" && detalhe.agregado?.veiculos != null && (
                <div style={{ fontSize: 12, color: "#475569", marginTop: 10 }}>{detalhe.agregado.veiculos} veículos distintos (chassi/placa) nessas OS.</div>
              )}
              {detalhe.def.id === "PV" && detalhe.agregado?.pedidos != null && (
                <div style={{ fontSize: 12, color: "#475569", marginTop: 10 }}>{detalhe.agregado.pedidos} pedidos ZREP/ZURB no mês.</div>
              )}

              <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, margin: "18px 0 6px" }}>Aferições (Honda × interno)</div>
              {detalhe.def.automatico && (detalhe.def.defasagem ?? 0) > 0 && (
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>A Honda mostra a compra com 1 dia de atraso: o interno é comparado até a véspera da aferição.</div>
              )}
              {afsDetalhe.length === 0 ? (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Nenhuma aferição lançada neste mês.</div>
              ) : (
                <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 420 }}>
                  <thead><tr style={{ color: "#64748b", textAlign: "left" }}>
                    <th style={th}>Data</th><th style={th}>Fonte</th><th style={{ ...th, textAlign: "right" }}>Honda</th>
                    {detalhe.def.automatico && <><th style={{ ...th, textAlign: "right" }}>Interno</th><th style={{ ...th, textAlign: "right" }}>Desvio</th></>}
                    <th style={th}>Por</th><th style={th}></th>
                  </tr></thead>
                  <tbody>
                    {afsDetalhe.map(a => {
                      const cmp = detalhe.def.automatico ? internoParaAfericao(detalhe.def, detalhe.agregado, Number(a.data.slice(8, 10))) : null;
                      const interno = cmp?.valor ?? null;
                      const dv = interno != null && a.valor ? interno / a.valor - 1 : null;
                      return (
                        <tr key={a.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={td}>{a.data.slice(8, 10)}/{a.data.slice(5, 7)}</td>
                          <td style={td}>{a.fonte}</td>
                          <td style={{ ...td, textAlign: "right" }}>{fmt(a.valor, detalhe.def.unidade)}</td>
                          {detalhe.def.automatico && <>
                            <td style={{ ...td, textAlign: "right" }} title={cmp ? `Compras até o dia ${cmp.ateDia}` : ""}>{fmt(interno, detalhe.def.unidade)}</td>
                            <td style={{ ...td, textAlign: "right", color: dv != null && Math.abs(dv) > 0.05 ? "#dc2626" : "#16a34a", fontWeight: 700 }}>{dv == null ? "—" : `${dv >= 0 ? "+" : ""}${pct(dv)}`}</td>
                          </>}
                          <td style={{ ...td, color: "#94a3b8" }}>{a.autor.split(" ")[0]}</td>
                          <td style={td}><button onClick={() => remover(a)} title="Remover" style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer" }}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              )}
            </>
          )}
        </div>

        {/* Lançar aferição */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form onSubmit={lancar} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>Lançar número da Honda</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>O valor acumulado do mês que aparece no Tableau ou no IHS hoje. Serve para medir o erro da regra interna.</div>
            <label style={lbl}>Indicador
              <select value={form.indicador} onChange={e => { const id = e.target.value as IndicadorId; setForm(f => ({ ...f, indicador: id, fonte: id === "PV" ? "IHS" : "Tableau" })); }} style={inp}>
                {INDICADORES.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={lbl}>Valor
                <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="ex.: 25.006,93" inputMode="decimal" required style={inp} />
              </label>
              <label style={lbl}>Data
                <input type="date" value={form.data} max={data?.hoje} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required style={inp} />
              </label>
            </div>
            <label style={lbl}>Fonte
              <select value={form.fonte} onChange={e => setForm(f => ({ ...f, fonte: e.target.value as "IHS" | "Tableau" }))} style={inp}>
                <option value="Tableau">Tableau (KPI After Sales)</option>
                <option value="IHS">IHS (PV Mensal de peças)</option>
              </select>
            </label>
            <button type="submit" style={{ ...btnPri, width: "100%", marginTop: 6 }}>Lançar para {store}</button>
          </form>

          {avisos.length > 0 && (
            <div style={{ ...card, padding: 16, borderColor: "#fecaca", background: "#fef2f2" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#b91c1c", marginBottom: 6 }}>Avisos da sincronização</div>
              {avisos.map((a, i) => <div key={i} style={{ fontSize: 11, color: "#991b1b", wordBreak: "break-word" }}>{a}</div>)}
            </div>
          )}

          {naoMap.length > 0 && (
            <div style={{ ...card, padding: 16, borderColor: "#fde68a", background: "#fffbeb" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#92400e", marginBottom: 6 }}>Itens sem de-para</div>
              <div style={{ fontSize: 11, color: "#92400e", marginBottom: 8 }}>Parecem óleo, pneu ou bateria, mas não estão em nenhuma regra. Classifique no de-para.</div>
              {naoMap.slice(0, 10).map(n => (
                <div key={n.codigoItem} style={{ fontSize: 11, color: "#78350f", padding: "3px 0", borderTop: "1px solid #fde68a" }}>
                  <b>{n.codigoItem}</b> — {n.descricao} · {n.quantidade} · {n.fornecedor.split(" ")[0]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function buscar(mes?: string): Promise<Payload> {
  const r = await fetch(`/api/metas-honda${mes ? `?mes=${mes}` : ""}`);
  if (!r.ok) throw new Error("Erro ao carregar as metas");
  return r.json();
}

const REGRA: Record<IndicadorId, string> = {
  PV:           "Moto Honda da Amazônia · só pedidos ZREP e ZURB · quantidade solicitada × valor unitário · mês da data de emissão. Pedido Avulso (PAV) e garantia (ZPUG) ficam fora.",
  OLEO_10W30:   "Pro Honda 10W30 frasco e tambor, em litros, qualquer distribuidor · mês da data de compra.",
  OLEO_SCOOTER: "Pro Honda Scooter 10W30, em litros · mês da data de compra.",
  OLEO_20W50:   "Pro Honda 20W50, em litros · mês da data de compra.",
  KIT_LUB:      "Kit Pro Honda de limpeza e lubrificação de corrente · o kit Staff N321 não conta.",
  PNEU:         "Pneus de revenda (Pirelli, Levorin, Honda) · Veipeças não conta · mês da data de compra.",
  BATERIA:      "Baterias Honda (31500…, R315…) · mês da data de compra.",
  TSI: "Pesquisa de satisfação — lançar a nota do Tableau.",
  PASSAGENS: "OS distintas abertas no mês (data de emissão), por tipo de OS · OS canceladas ficam fora. Regra a calibrar com as aferições do Tableau.",
  FATURAMENTO: "Faturamento de pós-venda — lançar o número do Tableau.",
};

function Row({ k, v, cor }: { k: string; v: string; cor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "1px 0" }}>
      <span style={{ color: "#94a3b8" }}>{k}</span>
      <span style={{ color: cor ?? "#334155", fontWeight: 700 }}>{v}</span>
    </div>
  );
}

function Quebra({ titulo, dados, u, cor }: { titulo: string; dados: Record<string, number>; u: IndicadorDef["unidade"]; cor: string }) {
  const itens = Object.entries(dados).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...itens.map(i => i[1]), 1);
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>{titulo}</div>
      {itens.length === 0 && <div style={{ fontSize: 12, color: "#cbd5e1" }}>—</div>}
      {itens.map(([k, v]) => (
        <div key={k} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#334155", fontWeight: 600 }}>{k}</span>
            <span style={{ color: "#334155" }}>{fmt(v, u)}</span>
          </div>
          <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2 }}>
            <div style={{ width: `${(v / max) * 100}%`, height: "100%", background: cor, borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const btnPri: React.CSSProperties = { padding: "8px 14px", background: NAVY, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const btnSec: React.CSSProperties = { padding: "6px 10px", background: "#fff", color: NAVY, border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const msg: React.CSSProperties = { border: "1px solid", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8 };
const inp: React.CSSProperties = { display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: "#0f172a", background: "#fff", boxSizing: "border-box" };
const th: React.CSSProperties = { padding: "4px 6px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "5px 6px", color: "#334155" };
