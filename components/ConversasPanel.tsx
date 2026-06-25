"use client";

import { useState, useEffect, useCallback } from "react";
import type { Role } from "@/lib/auth/users";
import { CONTACTS } from "@/components/ScriptsPanel";
import { FASES, OBJECOES, recomendar, faseDef, type FaseId, type ObjecaoId } from "@/lib/playbook";
import { precoOleo, type ManutencaoData, type Loja } from "@/lib/manutencao-model";

interface Props { user: { email: string; role: Role }; store: "CGR" | "TEM" }

interface WaContact { wa: string; nome: string; ultimaMsg: string; ultimaMsgAt: number; naoLidas: number; janela24hExpiraEm: number }
interface WaMessage { id: string; direction: "in" | "out"; type: string; body: string; timestamp: number }

const POLL_MS = 4000;
const money = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ConversasPanel({ user, store }: Props) {
  const loja: Loja = store === "CGR" ? "CGR" : "BAR";

  // dados de manutenção/preço
  const [manut, setManut] = useState<ManutencaoData | null>(null);
  // conversas
  const [phone, setPhone] = useState<string | null>(null);
  const [inbox, setInbox] = useState<WaContact[]>([]);
  const [activeWa, setActiveWa] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [janela, setJanela] = useState(false);
  const [text, setText] = useState("");
  // playbook (estado local — persistência por tag vem com o WhatsApp ao vivo)
  const [modelo, setModelo] = useState<string>("");
  const [fase, setFase] = useState<FaseId | null>(null);
  const [objecao, setObjecao] = useState<ObjecaoId | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/manutencao").then(r => r.json()).then(d => setManut(d.data ?? null)).catch(() => {});
    fetch("/api/whatsapp/connect").then(r => r.json()).then(d => {
      setPhone(d.mine?.phoneNumberId ?? d.all?.[0]?.phoneNumberId ?? null);
    }).catch(() => {});
  }, []);

  const loadInbox = useCallback(async (pn: string) => {
    const r = await fetch(`/api/whatsapp/inbox?phoneNumberId=${encodeURIComponent(pn)}`);
    if (r.ok) setInbox((await r.json()).inbox ?? []);
  }, []);
  const loadThread = useCallback(async (pn: string, wa: string) => {
    const r = await fetch(`/api/whatsapp/thread?phoneNumberId=${encodeURIComponent(pn)}&wa=${encodeURIComponent(wa)}`);
    if (r.ok) { const d = await r.json(); setMessages(d.messages ?? []); setJanela(!!d.janelaAberta); }
  }, []);

  useEffect(() => {
    if (!phone) return;
    loadInbox(phone);
    if (activeWa) loadThread(phone, activeWa);
    const id = setInterval(() => { loadInbox(phone); if (activeWa) loadThread(phone, activeWa); }, POLL_MS);
    return () => clearInterval(id);
  }, [phone, activeWa, loadInbox, loadThread]);

  const activeContact = inbox.find(c => c.wa === activeWa) ?? null;
  const nomeCliente = activeContact?.nome ?? "";

  // playbook
  const f = faseDef(fase);
  const rec = recomendar(fase, objecao);
  const script = rec ? CONTACTS[rec.contactId]?.scripts[rec.scriptId] ?? null : null;

  // preço da revisão selecionada
  const precoModelo = manut?.precos.find(p => p.modelo === modelo) ?? null;
  const km = f?.km ?? null;
  const base = precoModelo && km != null ? precoModelo.precos[String(km)] ?? null : null;
  const oleo = manut && modelo ? precoOleo(manut, modelo, loja) : null;
  const total = base != null || oleo != null ? (base ?? 0) + (oleo ?? 0) : null;

  function fill(t: string): string {
    return t
      .replace(/\{nome\}/g, nomeCliente || "{nome}")
      .replace(/\{consultor\}/g, user.email.split("@")[0])
      .replace(/\{km\}/g, km != null ? String(km) : "{km}");
  }

  function copyScript() {
    if (!script) return;
    navigator.clipboard.writeText(fill(script.text)).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function send() {
    if (!text.trim() || !phone || !activeWa) return;
    const r = await fetch("/api/whatsapp/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wa: activeWa, phoneNumberId: phone, body: text.trim() }),
    });
    if (r.ok) { setText(""); loadThread(phone, activeWa); }
  }

  async function enviarScript() {
    if (!rec || !phone || !activeWa) return;
    const r = await fetch("/api/whatsapp/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wa: activeWa, phoneNumberId: phone, contactId: rec.contactId, scriptId: rec.scriptId, vars: { nome: nomeCliente, consultor: user.email.split("@")[0], km: km != null ? String(km) : "" } }),
    });
    if (r.ok) loadThread(phone, activeWa);
  }

  return (
    <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff", height: "calc(100vh - 150px)", minHeight: 520 }}>

      {/* ── ESQUERDA: Conversas ── */}
      <div style={{ width: 230, flexShrink: 0, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", background: "#082F58" }}>
        <div style={{ padding: "14px 14px 10px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Conversas</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
          {inbox.length === 0 ? (
            <div style={{ padding: 18, fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
              Sem conversas.<br />O WhatsApp ao vivo conecta na próxima semana.
            </div>
          ) : inbox.map(c => {
            const active = c.wa === activeWa;
            return (
              <button key={c.wa} onClick={() => setActiveWa(c.wa)}
                style={{ width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontFamily: "inherit", background: active ? "#eff6ff" : "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{c.nome}</span>
                  {c.naoLidas > 0 && <span style={{ background: "#16a34a", color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "1px 6px" }}>{c.naoLidas}</span>}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.ultimaMsg}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CENTRO: Chat ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#FBB814", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#082F58", fontSize: 13 }}>
            {(nomeCliente || "?").slice(0, 2).toUpperCase()}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{nomeCliente || "Selecione uma conversa"}</div>
          {f && <span style={{ marginLeft: 6, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#e0e7ff", color: "#3730a3" }}>{f.label}</span>}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14, background: "#f8fafc", display: "flex", flexDirection: "column", gap: 7 }}>
          {!activeWa ? (
            <div style={{ margin: "auto", textAlign: "center", color: "#94a3b8", fontSize: 13, maxWidth: 280 }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>💬</div>
              O chat aparece aqui quando o WhatsApp estiver conectado.<br />
              Por enquanto, use o <strong>Playbook</strong> à direita para montar o atendimento.
            </div>
          ) : messages.map((m, i) => (
            <div key={m.id + i} style={{ alignSelf: m.direction === "out" ? "flex-end" : "flex-start", maxWidth: "72%" }}>
              <div style={{ padding: "8px 11px", borderRadius: 10, fontSize: 13, lineHeight: 1.45, background: m.direction === "out" ? "#082F58" : "#fff", color: m.direction === "out" ? "#fff" : "#0f172a", border: m.direction === "out" ? "none" : "1px solid #e2e8f0", whiteSpace: "pre-wrap" }}>
                {m.body}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #e2e8f0" }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }}
            placeholder={janela || !activeWa ? "Escreva uma mensagem..." : "Janela 24h fechada — use um script"}
            disabled={!activeWa || !janela}
            style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", background: !activeWa || !janela ? "#f8fafc" : "#fff" }} />
          <button onClick={send} disabled={!activeWa || !janela || !text.trim()}
            style={{ padding: "10px 16px", background: !activeWa || !janela || !text.trim() ? "#cbd5e1" : "#082F58", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>➤</button>
        </div>
      </div>

      {/* ── DIREITA: Playbook ── */}
      <div style={{ width: 340, flexShrink: 0, borderLeft: "1px solid #e2e8f0", overflowY: "auto", padding: 16 }}>
        {/* Contexto da moto */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Moto do cliente</div>
        <select value={modelo} onChange={e => setModelo(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", marginBottom: 12, background: "#fff" }}>
          <option value="">Selecione o modelo…</option>
          {manut?.precos.map(p => <option key={p.modelo} value={p.modelo}>{p.modelo}</option>)}
        </select>

        {/* Cartões de contexto */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <Ctx label="Revisão" value={km != null ? `${km.toLocaleString("pt-BR")} km` : "—"} />
          <Ctx label="Base" value={money(base)} />
          <Ctx label="Óleo" value={money(oleo)} />
          <Ctx label="Estimativa" value={money(total)} accent />
        </div>

        {/* Fases */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Fase do atendimento</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {FASES.map(x => {
            const on = fase === x.id;
            return (
              <button key={x.id} onClick={() => { setFase(on ? null : x.id); setObjecao(null); }}
                style={{ padding: "6px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: on ? "1px solid #FBB814" : "1px solid #e2e8f0", background: on ? "#FBB814" : "#fff", color: on ? "#082F58" : "#64748b" }}>
                {x.label}
              </button>
            );
          })}
        </div>

        {/* Objeções */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>O que o cliente disse</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {OBJECOES.map(o => {
            const on = objecao === o.id;
            return (
              <button key={o.id} onClick={() => setObjecao(on ? null : o.id)}
                style={{ padding: "6px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: on ? "1px solid #dc2626" : "1px solid #e2e8f0", background: on ? "#fef2f2" : "#fff", color: on ? "#b91c1c" : "#64748b" }}>
                {o.label}
              </button>
            );
          })}
        </div>

        {/* Script recomendado */}
        {script ? (
          <div style={{ border: "1px solid #e2e8f0", borderLeft: "3px solid #082F58", borderRadius: 8, padding: 14, background: "#f8fafc" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#082F58", textTransform: "uppercase", marginBottom: 8 }}>{script.title} · {script.tag}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "#0f172a", whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>{fill(script.text)}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <button onClick={copyScript}
                style={{ flex: 1, padding: "8px", background: copied ? "#166534" : "#e2e8f0", color: copied ? "#fff" : "#082F58", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {copied ? "✓ Copiado" : "Copiar"}
              </button>
              <button onClick={enviarScript} disabled={!activeWa}
                title={activeWa ? "Enviar no WhatsApp" : "Selecione uma conversa"}
                style={{ flex: 1, padding: "8px", background: !activeWa ? "#cbd5e1" : "#25D366", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: !activeWa ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                Enviar direto
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 16, border: "1px dashed #e2e8f0", borderRadius: 8 }}>
            Escolha uma fase (ou objeção) para ver o script recomendado.
          </div>
        )}
      </div>
    </div>
  );
}

function Ctx({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? "#082F58" : "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, color: accent ? "rgba(255,255,255,0.6)" : "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: accent ? "#FBB814" : "#082F58" }}>{value}</div>
    </div>
  );
}
