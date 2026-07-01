"use client";

import { useState, useEffect } from "react";

interface Membro { cargo: string; nome: string }
interface Contato { cargo: string; nome: string; email?: string; telefone?: string }
interface LojaInfo { nome: string; contatos: Contato[] }
interface Config {
  pin: string;
  horarios: { label: string; horario: string }[];
  equipe: { CGR: Membro[][]; TEM: Membro[][] };
  info: { CGR: LojaInfo; TEM: LojaInfo };
}

const inp: React.CSSProperties = { width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

export default function DisplayConfig() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [loja, setLoja] = useState<"CGR" | "TEM">("CGR");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/display").then(r => r.json()).then(d => setCfg(d.config ?? null)).catch(() => {});
  }, []);

  function patch(fn: (c: Config) => void) {
    setCfg(prev => { if (!prev) return prev; const c = structuredClone(prev); fn(c); return c; });
  }

  async function save() {
    if (!cfg) return;
    setSaving(true); setMsg("");
    const r = await fetch("/api/admin/display", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
    const d = await r.json();
    setMsg(r.ok ? "✅ Configuração do telão salva!" : `❌ ${d.error ?? "Erro ao salvar"}`);
    setSaving(false);
  }

  if (!cfg) return <div style={{ color: "#94a3b8", fontSize: 13 }}>Carregando...</div>;

  return (
    <div style={{ maxWidth: 820 }}>
      {/* PIN + horários */}
      <Card title="🔒 Acesso e horários">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <Lbl>PIN do telão (4 dígitos)</Lbl>
            <input value={cfg.pin} inputMode="numeric" maxLength={4}
              onChange={e => patch(c => { c.pin = e.target.value.replace(/\D/g, "").slice(0, 4); })}
              style={{ ...inp, width: 120, fontSize: 20, letterSpacing: 6, textAlign: "center" }} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Lbl>Horário de funcionamento</Lbl>
            {cfg.horarios.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input value={h.label} onChange={e => patch(c => { c.horarios[i].label = e.target.value; })} style={{ ...inp, flex: 1 }} />
                <input value={h.horario} onChange={e => patch(c => { c.horarios[i].horario = e.target.value; })} style={{ ...inp, flex: 1 }} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Seletor de loja */}
      <div style={{ display: "flex", gap: 6, margin: "16px 0", background: "#f1f5f9", borderRadius: 9, padding: 4, width: "fit-content" }}>
        {(["CGR", "TEM"] as const).map(l => (
          <button key={l} onClick={() => setLoja(l)}
            style={{ padding: "7px 16px", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, background: loja === l ? "#082F58" : "transparent", color: loja === l ? "#fff" : "#64748b" }}>
            {l === "CGR" ? "Campo Grande" : "Barretos"}
          </button>
        ))}
      </div>

      {/* Organograma */}
      <Card title={`👥 Nossa Equipe — ${loja === "CGR" ? "Campo Grande" : "Barretos"}`}>
        {cfg.equipe[loja].map((nivel, ni) => (
          <div key={ni} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Nível {ni + 1}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {nivel.map((m, mi) => (
                <div key={mi} style={{ display: "flex", gap: 6 }}>
                  <input value={m.cargo} placeholder="Cargo" onChange={e => patch(c => { c.equipe[loja][ni][mi].cargo = e.target.value; })} style={{ ...inp, flex: "0 0 40%" }} />
                  <input value={m.nome} placeholder="Nome" onChange={e => patch(c => { c.equipe[loja][ni][mi].nome = e.target.value; })} style={{ ...inp, flex: 1 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>

      {/* Contatos */}
      <Card title={`ℹ️ Informações / Contatos — ${loja === "CGR" ? "Campo Grande" : "Barretos"}`}>
        {cfg.info[loja].contatos.map((ct, ci) => (
          <div key={ci} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #f1f5f9" }}>
            <input value={ct.cargo} placeholder="Cargo" onChange={e => patch(c => { c.info[loja].contatos[ci].cargo = e.target.value; })} style={inp} />
            <input value={ct.nome} placeholder="Nome" onChange={e => patch(c => { c.info[loja].contatos[ci].nome = e.target.value; })} style={inp} />
            <input value={ct.email ?? ""} placeholder="E-mail" onChange={e => patch(c => { c.info[loja].contatos[ci].email = e.target.value; })} style={inp} />
            <input value={ct.telefone ?? ""} placeholder="Telefone / ramal" onChange={e => patch(c => { c.info[loja].contatos[ci].telefone = e.target.value; })} style={inp} />
          </div>
        ))}
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
        <button onClick={save} disabled={saving}
          style={{ padding: "11px 20px", background: saving ? "#94a3b8" : "#082F58", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {saving ? "Salvando..." : "Salvar configuração do telão"}
        </button>
        <a href="/display" target="_blank" style={{ fontSize: 13, color: "#082F58", fontWeight: 600 }}>Abrir telão ↗</a>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith("✅") ? "#15803d" : "#b91c1c" }}>{msg}</span>}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}
function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{children}</div>;
}
