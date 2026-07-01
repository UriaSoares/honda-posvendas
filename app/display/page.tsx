"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Loja = "CGR" | "TEM";

interface Agendamento {
  Empresa?: string; Proprietario?: string; Modelo?: string;
  HoraInicioRecepcao?: string; TipoOS?: string; Situacao?: string;
  DataRecepcao?: string; InicioOficina?: string;
}
interface Apontamento {
  Empresa?: string; Tecnico?: string; NumeroOS?: number | null; Servico?: string; Placa?: string;
  HorasApontadas?: number; HorasPrevistas?: number; SituacaoApontamento?: string;
}
interface Preco { modelo: string; precos: Record<string, number | null> }
interface Promo { title: string; body: string }
interface Membro { cargo: string; nome: string }
interface Contato { cargo: string; nome: string; email?: string; telefone?: string }
interface LojaInfo { nome: string; contatos: Contato[] }
interface Config {
  horarios: { label: string; horario: string }[];
  equipe: { CGR: Membro[][]; TEM: Membro[][] };
  info: { CGR: LojaInfo; TEM: LojaInfo };
}

const SLIDE_INTERVAL = 15_000;
const REVISOES = ["1000", "6000", "12000", "18000", "24000", "30000"];
const LOJA_NOME: Record<Loja, string> = { CGR: "Campo Grande", TEM: "Barretos" };

const money = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span>{t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>;
}

/* ───────── Slide 1: Agenda (±2h) ───────── */
function SlideAgenda({ agendamentos, loja }: { agendamentos: Agendamento[]; loja: Loja }) {
  const now = Date.now(), H2 = 2 * 3600 * 1000;
  const tempo = (a: Agendamento): number | null => {
    const s = a.InicioOficina || (a.DataRecepcao && a.HoraInicioRecepcao ? `${a.DataRecepcao.slice(0, 10)}T${a.HoraInicioRecepcao}:00` : "");
    const t = s ? new Date(s).getTime() : NaN;
    return isNaN(t) ? null : t;
  };
  const janela = agendamentos
    .filter(a => (a.Empresa ?? "").toUpperCase() === loja)
    .map(a => ({ a, t: tempo(a) }))
    .filter(x => x.t != null && x.t >= now - H2 && x.t <= now + H2)
    .sort((x, y) => (x.t! - y.t!));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SlideHead titulo="Agenda da oficina" sub={`${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} · janela de 2h`} n={`${janela.length} na janela`} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 20 }}>
          <thead><tr>
            {["Hora", "Cliente", "Modelo", "Serviço", "Status"].map(h => (
              <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "rgba(255,255,255,0.45)", fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {janela.map(({ a }, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "15px 16px", fontWeight: 800, color: "#FBB814", fontSize: 22 }}>{a.HoraInicioRecepcao?.slice(0, 5) ?? "—"}</td>
                <td style={{ padding: "15px 16px", fontWeight: 600, color: "#fff" }}>{a.Proprietario ?? "—"}</td>
                <td style={{ padding: "15px 16px", color: "rgba(255,255,255,0.75)" }}>{a.Modelo ?? "—"}</td>
                <td style={{ padding: "15px 16px", color: "rgba(255,255,255,0.6)" }}>{a.TipoOS ?? "—"}</td>
                <td style={{ padding: "15px 16px" }}><Sit sit={a.Situacao ?? ""} /></td>
              </tr>
            ))}
            {janela.length === 0 && <tr><td colSpan={5} style={{ padding: 50, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 18 }}>Nenhum atendimento na janela de 2 horas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────── Slide 2: Técnicos ───────── */
function SlideTecnicos({ apontamentos, loja }: { apontamentos: Apontamento[]; loja: Loja }) {
  const ap = apontamentos.filter(a => (a.Empresa ?? "").toUpperCase() === loja);
  const map = ap.reduce((m, a) => {
    const t = a.Tecnico ?? "Técnico";
    if (!m.has(t)) m.set(t, []); m.get(t)!.push(a); return m;
  }, new Map<string, Apontamento[]>());
  const tecs = Array.from(map.entries());

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SlideHead titulo="Técnicos ao vivo" sub={`${LOJA_NOME[loja]}`} n={`${tecs.length} técnicos`} />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18, alignContent: "start" }}>
        {tecs.map(([nome, aps]) => {
          const ativo = aps.find(a => (a.SituacaoApontamento ?? "").toUpperCase() === "ABERTO");
          return (
            <div key={nome} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 14, padding: 20, border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: ativo ? "#22c55e" : "#64748b" }} />
                <span style={{ fontWeight: 800, fontSize: 19, color: "#fff" }}>{nome}</span>
              </div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)" }}>
                {ativo ? `🔧 ${ativo.Servico || "Serviço"}${ativo.Placa ? ` · ${ativo.Placa}` : ""}` : "Sem serviço em andamento"}
              </div>
            </div>
          );
        })}
        {tecs.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 18, paddingTop: 40 }}>Nenhum apontamento no momento.</div>}
      </div>
    </div>
  );
}

/* ───────── Slide 3: Promoção ───────── */
function SlidePromo({ promo }: { promo: Promo }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 3, marginBottom: 24 }}>📢 Promoção da semana</div>
      {promo.title ? (<>
        <div style={{ fontSize: 52, fontWeight: 900, color: "#FBB814", lineHeight: 1.15, marginBottom: 24, maxWidth: 900 }}>{promo.title}</div>
        <div style={{ fontSize: 26, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, maxWidth: 760, whiteSpace: "pre-wrap" }}>{promo.body}</div>
      </>) : <div style={{ fontSize: 22, color: "rgba(255,255,255,0.3)" }}>Nenhuma promoção configurada.</div>}
    </div>
  );
}

/* ───────── Slide 4: Nossa Equipe ───────── */
function SlideEquipe({ equipe, loja }: { equipe: Membro[][]; loja: Loja }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SlideHead titulo="Nossa Equipe" sub={LOJA_NOME[loja]} n="" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        {equipe.map((nivel, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            {nivel.map((m, j) => (
              <div key={j} style={{ background: i === 0 ? "#FBB814" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "14px 22px", minWidth: 180, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: i === 0 ? "#663d00" : "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{m.cargo}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: i === 0 ? "#082F58" : "#fff", marginTop: 3 }}>{m.nome || "—"}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Slide 5: Informações ───────── */
function SlideInfo({ horarios, info }: { horarios: Config["horarios"]; info: LojaInfo }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SlideHead titulo="Informações" sub={info.nome} n="" />
      <div style={{ flex: 1, display: "flex", gap: 30 }}>
        <div style={{ flex: "0 0 340px" }}>
          <div style={{ fontSize: 15, color: "#FBB814", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>⏰ Horário de funcionamento</div>
          {horarios.map((h, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)" }}>{h.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>{h.horario}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, color: "#FBB814", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>👥 Contatos</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {info.contatos.map((c, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 18px" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>{c.cargo}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{c.nome}</div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                  {c.email}{c.telefone ? `  ·  ${c.telefone}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Slide 6: Tabela de Preços ───────── */
function SlidePrecos({ precos }: { precos: Preco[] }) {
  const comValor = precos.filter(p => REVISOES.some(k => p.precos[k] != null));
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SlideHead titulo="Tabela de Preços — Revisões" sub="Valores de mão de obra por revisão" n="" />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 18 }}>
          <thead><tr>
            <th style={{ padding: "10px 14px", textAlign: "left", color: "rgba(255,255,255,0.45)", fontSize: 13, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Modelo</th>
            {REVISOES.map(k => <th key={k} style={{ padding: "10px 14px", textAlign: "right", color: "rgba(255,255,255,0.45)", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>{Number(k).toLocaleString("pt-BR")}</th>)}
          </tr></thead>
          <tbody>
            {comValor.map(p => (
              <tr key={p.modelo} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#fff" }}>{p.modelo}</td>
                {REVISOES.map(k => <td key={k} style={{ padding: "12px 14px", textAlign: "right", color: p.precos[k] != null ? "#FBB814" : "rgba(255,255,255,0.25)", fontWeight: 600 }}>{money(p.precos[k])}</td>)}
              </tr>
            ))}
            {comValor.length === 0 && <tr><td colSpan={7} style={{ padding: 50, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 18 }}>Sincronize a tabela de preços no ADM.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────── Helpers de slide ───────── */
function SlideHead({ titulo, sub, n }: { titulo: string; sub: string; n: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, borderBottom: "2px solid rgba(255,255,255,0.1)", paddingBottom: 14 }}>
      <div>
        <div style={{ fontSize: 34, fontWeight: 900, color: "#fff" }}>{titulo}</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", textTransform: "capitalize" }}>{sub}</div>
      </div>
      {n && <div style={{ fontSize: 18, color: "#FBB814", fontWeight: 700 }}>{n}</div>}
    </div>
  );
}
const SIT: { m: string; bg: string; c: string; l: string }[] = [
  { m: "BAIXAD", bg: "#052e16", c: "#4ade80", l: "Baixado" },
  { m: "ABERTO", bg: "#082f49", c: "#38bdf8", l: "Aguardando" },
  { m: "REAGEND", bg: "#422006", c: "#fbbf24", l: "Reagendado" },
  { m: "COMPARECEU", bg: "#450a0a", c: "#f87171", l: "Não veio" },
  { m: "CANCEL", bg: "#450a0a", c: "#f87171", l: "Cancelado" },
];
function Sit({ sit }: { sit: string }) {
  const up = (sit ?? "").toUpperCase();
  const s = SIT.find(x => up.includes(x.m)) ?? { bg: "rgba(255,255,255,0.08)", c: "rgba(255,255,255,0.6)", l: sit || "—" };
  return <span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 15, fontWeight: 700, background: s.bg, color: s.c }}>{s.l}</span>;
}

/* ───────── Página ───────── */
export default function DisplayPage() {
  const [loja, setLoja] = useState<Loja | null>(null);
  const [pinOk, setPinOk] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);

  const [slide, setSlide] = useState(0);
  const [ag, setAg] = useState<Agendamento[]>([]);
  const [ap, setAp] = useState<Apontamento[]>([]);
  const [precos, setPrecos] = useState<Preco[]>([]);
  const [promo, setPromo] = useState<Promo>({ title: "", body: "" });
  const [config, setConfig] = useState<Config | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // valida PIN salvo quando escolhe a loja
  useEffect(() => {
    if (!loja) return;
    const saved = localStorage.getItem("display_pin");
    if (!saved) return;
    fetch("/api/display/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: saved }) })
      .then(r => r.json()).then(d => { if (d.ok) setPinOk(true); else localStorage.removeItem("display_pin"); }).catch(() => {});
  }, [loja]);

  const fetchAll = useCallback(async () => {
    try {
      const [rd, rp, rc] = await Promise.all([fetch("/api/display/data"), fetch("/api/admin/promo"), fetch("/api/display/config")]);
      const [dd, dp, dc] = await Promise.all([rd.json(), rp.json(), rc.json()]);
      setAg(dd.agendamentos ?? []); setAp(dd.apontamentos ?? []); setPrecos(dd.precos ?? []);
      setPromo(dp.promo ?? { title: "", body: "" }); setConfig(dc.config ?? null);
    } catch { /* mantém dados antigos */ }
  }, []);

  const SLIDES = 6;
  useEffect(() => {
    if (!pinOk) return;
    fetchAll();
    const dataId = setInterval(fetchAll, 2 * 60 * 1000);
    timer.current = setInterval(() => setSlide(s => (s + 1) % SLIDES), SLIDE_INTERVAL);
    return () => { clearInterval(dataId); if (timer.current) clearInterval(timer.current); };
  }, [pinOk, fetchAll]);

  async function submitPin(p: string) {
    const r = await fetch("/api/display/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: p }) });
    const d = await r.json();
    if (d.ok) { localStorage.setItem("display_pin", p); setPinOk(true); }
    else { setPinErr(true); setPin(""); setTimeout(() => setPinErr(false), 1500); }
  }
  function keyPress(k: string) {
    if (k === "del") { setPin(p => p.slice(0, -1)); return; }
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) submitPin(next);
  }

  const bg = { minHeight: "100vh", background: "#082F58", fontFamily: "var(--font-manrope), sans-serif", color: "#fff" } as React.CSSProperties;

  // ── Landing: escolher a loja ──
  if (!loja) {
    return (
      <div style={{ ...bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Caiobá Honda — <span style={{ color: "#FBB814" }}>Recepção</span></div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}>Selecione a loja</div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {(["CGR", "TEM"] as Loja[]).map(l => (
            <button key={l} onClick={() => setLoja(l)}
              style={{ background: "rgba(255,255,255,0.06)", border: "2px solid #FBB814", borderRadius: 18, padding: "36px 48px", cursor: "pointer", fontFamily: "inherit", color: "#fff", minWidth: 280 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏪</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>Recepção {LOJA_NOME[l]}</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}>{l}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Trava por PIN ──
  if (!pinOk) {
    return (
      <div style={{ ...bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Recepção {LOJA_NOME[loja]}</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>Digite o PIN de acesso</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ width: 22, height: 22, borderRadius: "50%", background: i < pin.length ? "#FBB814" : "rgba(255,255,255,0.15)", border: pinErr ? "2px solid #f87171" : "none" }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 84px)", gap: 12 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) => (
            k === "" ? <div key={i} /> :
              <button key={i} onClick={() => keyPress(k)}
                style={{ height: 84, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 28, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {k === "del" ? "⌫" : k}
              </button>
          ))}
        </div>
        <button onClick={() => { setLoja(null); setPin(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>← trocar loja</button>
      </div>
    );
  }

  // ── Telão ──
  const eq = config?.equipe[loja] ?? [];
  const info = config?.info[loja];
  const labels = ["Agenda", "Técnicos", "Promoção", "Equipe", "Informações", "Preços"];

  return (
    <div style={{ ...bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "#FBB814", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔧</div>
          <span style={{ fontSize: 16, fontWeight: 800 }}>Caiobá Honda — <span style={{ color: "#FBB814" }}>{LOJA_NOME[loja]}</span></span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#FBB814", fontVariantNumeric: "tabular-nums" }}><Clock /></div>
      </div>

      <div style={{ flex: 1, padding: "28px 36px", overflow: "hidden" }}>
        {slide === 0 && <SlideAgenda agendamentos={ag} loja={loja} />}
        {slide === 1 && <SlideTecnicos apontamentos={ap} loja={loja} />}
        {slide === 2 && <SlidePromo promo={promo} />}
        {slide === 3 && <SlideEquipe equipe={eq} loja={loja} />}
        {slide === 4 && info && <SlideInfo horarios={config!.horarios} info={info} />}
        {slide === 5 && <SlidePrecos precos={precos} />}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "12px 0 18px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {labels.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: slide === i ? "#FBB814" : "rgba(255,255,255,0.1)", color: slide === i ? "#082F58" : "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 700 }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
