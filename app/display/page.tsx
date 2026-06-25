"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Agendamento {
  Empresa?: string; Proprietario?: string; Modelo?: string;
  HoraInicioRecepcao?: string; TipoOS?: string; Situacao?: string;
  AgendamentoHoje?: boolean | string | number;
  DataRecepcao?: string; InicioOficina?: string; DataOficina?: string;
}

function dateInSP(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Campo_Grande" });
}

interface Apontamento {
  Empresa?: string; Tecnico?: string; OS?: string;
  HorasApontadas?: number; HorasPrevistas?: number; Situacao?: string;
}

interface Promo { title: string; body: string }

const SLIDE_INTERVAL = 15_000; // 15 s

const STATUS_COLORS: Record<string, string> = {
  "AGENDADO":       "#0369a1",
  "CHEGOU":         "#15803d",
  "EM SERVIÇO":     "#d97706",
  "CONCLUIDO":      "#16a34a",
  "CONCLUÍDO":      "#16a34a",
  "NAO COMPARECEU": "#dc2626",
  "NÃO COMPARECEU": "#dc2626",
  "CANCELADO":      "#dc2626",
};
const STATUS_BG: Record<string, string> = {
  "AGENDADO":       "#e0f2fe",
  "CHEGOU":         "#dcfce7",
  "EM SERVIÇO":     "#fef9c3",
  "CONCLUIDO":      "#f0fdf4",
  "CONCLUÍDO":      "#f0fdf4",
  "NAO COMPARECEU": "#fef2f2",
  "NÃO COMPARECEU": "#fef2f2",
  "CANCELADO":      "#fef2f2",
};

function statusStyle(sit: string): React.CSSProperties {
  const k = (sit ?? "").toUpperCase();
  const entry = Object.entries(STATUS_COLORS).find(([key]) => k.includes(key));
  const bg  = entry ? STATUS_BG[entry[0]]  : "#f1f5f9";
  const col = entry ? entry[1]             : "#64748b";
  return { background: bg, color: col };
}

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span>{time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
  );
}

/* ── Slide 1: Agenda do dia ── */
function SlideAgenda({ agendamentos }: { agendamentos: Agendamento[] }) {
  const hojeStr = dateInSP(0);
  const hoje = agendamentos
    .filter(a => {
      const d = (a.DataRecepcao || a.InicioOficina || a.DataOficina || "").slice(0, 10);
      return d === hojeStr || Number(a.AgendamentoHoje) === 1;
    })
    .sort((a, b) => (a.HoraInicioRecepcao ?? "").localeCompare(b.HoraInicioRecepcao ?? ""));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
          📅 Agenda do dia
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <div style={{ fontSize: 16, color: "#FBB814", fontWeight: 600, marginTop: 4 }}>
          {hoje.length} agendamentos
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 16 }}>
          <thead>
            <tr>
              {["Hora", "Cliente", "Modelo", "Tipo OS", "Status"].map(h => (
                <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "rgba(255,255,255,0.45)", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hoje.map((a, i) => {
              const sitKey = Object.keys(STATUS_COLORS).find(k => (a.Situacao ?? "").toUpperCase().includes(k));
              const sitBg  = sitKey ? STATUS_BG[sitKey]    : "#1e293b";
              const sitCol = sitKey ? STATUS_COLORS[sitKey] : "rgba(255,255,255,0.5)";
              return (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: "13px 14px", fontWeight: 800, color: "#FBB814", fontSize: 17 }}>
                    {a.HoraInicioRecepcao?.slice(0, 5) ?? "—"}
                  </td>
                  <td style={{ padding: "13px 14px", fontWeight: 600, color: "#fff", fontSize: 15 }}>
                    {a.Proprietario ?? "—"}
                  </td>
                  <td style={{ padding: "13px 14px", color: "rgba(255,255,255,0.75)" }}>
                    {a.Modelo ?? "—"}
                  </td>
                  <td style={{ padding: "13px 14px", color: "rgba(255,255,255,0.6)" }}>
                    {a.TipoOS ?? "—"}
                  </td>
                  <td style={{ padding: "13px 14px" }}>
                    <span style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: sitBg, color: sitCol,
                    }}>
                      {a.Situacao ?? "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {hoje.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 15 }}>
                  Nenhum agendamento para hoje.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Slide 2: Técnicos ao vivo ── */
function SlideTecnicos({ apontamentos }: { apontamentos: Apontamento[] }) {
  const tecMap = apontamentos.reduce((m, a) => {
    const t = a.Tecnico ?? "Técnico";
    if (!m.has(t)) m.set(t, { horas: 0, prev: 0, oss: 0 });
    const e = m.get(t)!;
    e.horas += a.HorasApontadas ?? 0;
    e.prev  += a.HorasPrevistas ?? 0;
    e.oss   += 1;
    return m;
  }, new Map<string, { horas: number; prev: number; oss: number }>());

  const tecs = Array.from(tecMap.entries()).sort((a, b) => b[1].horas - a[1].horas);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
          🔧 Técnicos ao vivo
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>
          {tecs.length} técnico{tecs.length !== 1 ? "s" : ""} em atividade
        </div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18, alignContent: "start" }}>
        {tecs.map(([name, d]) => {
          const pct = d.prev > 0 ? Math.min(100, Math.round((d.horas / d.prev) * 100)) : 0;
          return (
            <div key={name} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 14, padding: 20, border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#fff" }}>{name}</div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{d.oss} OS</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 99, height: 8, overflow: "hidden", marginBottom: 8 }}>
                <div style={{
                  height: "100%", borderRadius: 99, transition: "width 0.5s",
                  background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#FBB814" : "#60a5fa",
                  width: `${pct}%`,
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
                <span>{d.horas.toFixed(1)}h / {d.prev.toFixed(1)}h</span>
                <span style={{ fontWeight: 700, color: pct >= 80 ? "#22c55e" : "rgba(255,255,255,0.55)" }}>{pct}%</span>
              </div>
            </div>
          );
        })}
        {tecs.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 15, paddingTop: 40 }}>
            Nenhum apontamento no momento.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Slide 3: Promoção ── */
function SlidePromo({ promo }: { promo: Promo }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 3, marginBottom: 24 }}>
        📢 Promoção da semana
      </div>
      {promo.title ? (
        <>
          <div style={{ fontSize: 48, fontWeight: 900, color: "#FBB814", lineHeight: 1.15, marginBottom: 24, maxWidth: 800 }}>
            {promo.title}
          </div>
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, maxWidth: 700, whiteSpace: "pre-wrap" }}>
            {promo.body}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.3)" }}>
          Nenhuma promoção configurada.<br />
          <span style={{ fontSize: 14, marginTop: 8, display: "block" }}>
            Acesse o painel ADM para adicionar.
          </span>
        </div>
      )}
      <div style={{
        marginTop: 56, padding: "12px 28px", background: "rgba(251,184,20,0.15)",
        border: "1px solid rgba(251,184,20,0.3)", borderRadius: 40,
        fontSize: 16, fontWeight: 700, color: "#FBB814",
      }}>
        Fale com a nossa equipe! 😊
      </div>
    </div>
  );
}

/* ── Main Display ── */
export default function DisplayPage() {
  const [slide,   setSlide]   = useState(0);
  const [ag,      setAg]      = useState<Agendamento[]>([]);
  const [ap,      setAp]      = useState<Apontamento[]>([]);
  const [promo,   setPromo]   = useState<Promo>({ title: "", body: "" });
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [rd, rpr] = await Promise.all([
        fetch("/api/display/data"),
        fetch("/api/admin/promo"),
      ]);
      const [dd, dpr] = await Promise.all([rd.json(), rpr.json()]);
      setAg(dd.agendamentos ?? []);
      setAp(dd.apontamentos ?? []);
      setPromo(dpr.promo ?? { title: "", body: "" });
    } catch { /* silently fail, show stale data */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    // refresh data every 2 minutes
    const id = setInterval(fetchAll, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Auto-rotate slides
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSlide(s => (s + 1) % 3);
    }, SLIDE_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function goSlide(n: number) {
    setSlide(n);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSlide(s => (s + 1) % 3), SLIDE_INTERVAL);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#082F58",
      fontFamily: "var(--font-manrope), sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 28px", borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: "#FBB814", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>🔧</div>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            Caiobá Honda — <span style={{ color: "#FBB814" }}>Pós-Vendas</span>
          </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#FBB814", fontVariantNumeric: "tabular-nums" }}>
          <Clock />
        </div>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, padding: "28px 36px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.4)", fontSize: 18 }}>
            Carregando dados...
          </div>
        ) : (
          <>
            {slide === 0 && <SlideAgenda agendamentos={ag} />}
            {slide === 1 && <SlideTecnicos apontamentos={ap} />}
            {slide === 2 && <SlidePromo promo={promo} />}
          </>
        )}
      </div>

      {/* Slide indicators */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 10,
        padding: "14px 0 20px", borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        {["Agenda", "Técnicos", "Promoção"].map((label, i) => (
          <button
            key={i}
            onClick={() => goSlide(i)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
              borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit",
              background: slide === i ? "#FBB814" : "rgba(255,255,255,0.1)",
              color: slide === i ? "#082F58" : "rgba(255,255,255,0.45)",
              fontSize: 12, fontWeight: 700,
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: slide === i ? "#082F58" : "rgba(255,255,255,0.3)",
            }} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
