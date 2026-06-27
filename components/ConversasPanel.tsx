"use client";

import { useState, useEffect, useCallback } from "react";
import type { Role } from "@/lib/auth/users";
import { CONTACTS } from "@/components/ScriptsPanel";
import { FASES, OBJECOES, faseDef, type FaseId, type ObjecaoId } from "@/lib/playbook";
import { ROTEIRO_SCRIPTS, OBJECAO_SCRIPTS, SITUACAO_SCRIPTS, FAQ_SCRIPTS, type RoteiroScript } from "@/lib/roteiro-scripts";
import { precoOleo, type ManutencaoData, type Loja } from "@/lib/manutencao-model";

interface Props { user: { email: string; role: Role }; store: "CGR" | "TEM" }

interface WaContact { wa: string; nome: string; ultimaMsg: string; ultimaMsgAt: number; naoLidas: number; janela24hExpiraEm: number }
interface WaMessage { id: string; direction: "in" | "out"; type: string; body: string; timestamp: number }

const POLL_MS = 4000;
const money = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Fallback p/ objeções mantidas pelo sistema antigo (Sem tempo / Vou pensar).
function fallbackObjScripts(obj: ObjecaoId): RoteiroScript[] {
  const def = OBJECOES.find(o => o.id === obj);
  if (!def) return [];
  const s = CONTACTS[def.contactId]?.scripts[def.scriptId];
  return s ? [{ id: `${obj}_sys`, rotulo: s.tag, texto: s.text }] : [];
}

export default function ConversasPanel({ user, store }: Props) {
  const loja: Loja = store === "CGR" ? "CGR" : "BAR";

  const [manut, setManut] = useState<ManutencaoData | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [inbox, setInbox] = useState<WaContact[]>([]);
  const [activeWa, setActiveWa] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [janela, setJanela] = useState(false);
  const [text, setText] = useState("");

  // playbook (estado local)
  const [aba, setAba]         = useState<"playbook" | "faq">("playbook");
  const [modelo, setModelo]   = useState<string>("");
  const [fase, setFase]       = useState<FaseId | null>(null);
  const [objecao, setObjecao] = useState<ObjecaoId | null>(null);
  const [situacao, setSituacao] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sentId, setSentId]     = useState<string | null>(null);
  const [faqOpen, setFaqOpen]   = useState<string | null>(null);

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

  // contexto de preço
  const f = faseDef(fase);
  const precoModelo = manut?.precos.find(p => p.modelo === modelo) ?? null;
  const km = f?.km ?? null;
  const base = precoModelo && km != null ? precoModelo.precos[String(km)] ?? null : null;
  const oleo = manut && modelo ? precoOleo(manut, modelo, loja) : null;
  const total = base != null || oleo != null ? (base ?? 0) + (oleo ?? 0) : null;

  // scripts a exibir (situação > objeção > fase)
  const scripts: RoteiroScript[] =
    situacao ? (SITUACAO_SCRIPTS[situacao] ?? [])
    : objecao ? (OBJECAO_SCRIPTS[objecao] ?? fallbackObjScripts(objecao))
    : fase ? (ROTEIRO_SCRIPTS[fase] ?? [])
    : [];

  function fill(t: string): string {
    return t
      .replace(/\{nome\}/g, nomeCliente || "{nome}")
      .replace(/\{consultor\}/g, user.email.split("@")[0])
      .replace(/\{km\}/g, km != null ? String(km) : "{km}");
  }

  function copiar(s: RoteiroScript) {
    navigator.clipboard.writeText(fill(s.texto)).catch(() => {});
    setCopiedId(s.id); setTimeout(() => setCopiedId(null), 2000);
  }
  async function enviar(s: RoteiroScript) {
    if (!phone || !activeWa) return;
    setSentId(s.id);
    const r = await fetch("/api/whatsapp/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wa: activeWa, phoneNumberId: phone, body: fill(s.texto) }),
    });
    if (r.ok) loadThread(phone, activeWa);
    setTimeout(() => setSentId(null), 2000);
  }
  async function send() {
    if (!text.trim() || !phone || !activeWa) return;
    const r = await fetch("/api/whatsapp/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wa: activeWa, phoneNumberId: phone, body: text.trim() }),
    });
    if (r.ok) { setText(""); loadThread(phone, activeWa); }
  }

  function pickFase(id: FaseId) { setFase(fase === id ? null : id); setObjecao(null); setSituacao(null); }
  function pickObjecao(id: ObjecaoId) { setObjecao(objecao === id ? null : id); setSituacao(null); }
  function pickSituacao(id: string) { setSituacao(situacao === id ? null : id); setObjecao(null); }

  return (
    <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff", height: "calc(100vh - 150px)", minHeight: 520 }}>

      {/* ESQUERDA: Conversas */}
      <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", background: "#082F58" }}>
        <div style={{ padding: "14px 14px 10px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Conversas</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
          {inbox.length === 0 ? (
            <div style={{ padding: 18, fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
              Sem conversas.<br />O WhatsApp ao vivo conecta em breve.
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

      {/* CENTRO: Chat */}
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

      {/* DIREITA: Playbook / FAQ */}
      <div style={{ width: 360, flexShrink: 0, borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* abas */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
          {(["playbook", "faq"] as const).map(t => (
            <button key={t} onClick={() => setAba(t)}
              style={{ flex: 1, padding: "10px", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: aba === t ? "#fff" : "#f8fafc", color: aba === t ? "#082F58" : "#94a3b8",
                borderBottom: aba === t ? "2px solid #FBB814" : "2px solid transparent" }}>
              {t === "playbook" ? "🎯 Playbook" : "❓ Perguntas frequentes"}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {aba === "faq" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FAQ_SCRIPTS.map(q => {
                const open = faqOpen === q.id;
                return (
                  <div key={q.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                    <button onClick={() => setFaqOpen(open ? null : q.id)}
                      style={{ width: "100%", textAlign: "left", padding: "10px 12px", border: "none", cursor: "pointer", fontFamily: "inherit", background: open ? "#f8fafc" : "#fff", fontSize: 12.5, fontWeight: 700, color: "#082F58", display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{q.pergunta}</span><span style={{ color: "#94a3b8" }}>{open ? "−" : "+"}</span>
                    </button>
                    {open && (
                      <div style={{ padding: "0 12px 12px" }}>
                        {q.oCliente && <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic", marginBottom: 6 }}>💭 {q.oCliente}</div>}
                        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "#0f172a", whiteSpace: "pre-wrap" }}>{q.resposta}</div>
                        <button onClick={() => navigator.clipboard.writeText(q.resposta).catch(() => {})}
                          style={{ marginTop: 8, padding: "6px 12px", background: "#e2e8f0", color: "#082F58", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Copiar resposta</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {/* Moto */}
              <Label>Moto do cliente</Label>
              <select value={modelo} onChange={e => setModelo(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", marginBottom: 12, background: "#fff" }}>
                <option value="">Selecione o modelo…</option>
                {manut?.precos.map(p => <option key={p.modelo} value={p.modelo}>{p.modelo}</option>)}
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <Ctx label="Revisão" value={km != null ? `${km.toLocaleString("pt-BR")} km` : "—"} />
                <Ctx label="Base" value={money(base)} />
                <Ctx label="Óleo" value={money(oleo)} />
                <Ctx label="Estimativa" value={money(total)} accent />
              </div>

              {/* Fases */}
              <Label>Fase do atendimento</Label>
              <Chips>
                {FASES.map(x => <Chip key={x.id} on={fase === x.id} onClick={() => pickFase(x.id)}>{x.label}</Chip>)}
              </Chips>

              {/* Objeções + situação */}
              <Label>O que o cliente disse</Label>
              <Chips>
                {OBJECOES.map(o => <Chip key={o.id} danger on={objecao === o.id} onClick={() => pickObjecao(o.id)}>{o.label}</Chip>)}
                <Chip warn on={situacao === "sem_resposta"} onClick={() => pickSituacao("sem_resposta")}>Não respondeu</Chip>
              </Chips>

              {/* Scripts (todas as opções) */}
              {scripts.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {scripts.map((s, i) => (
                    <div key={s.id} style={{ border: "1px solid #e2e8f0", borderLeft: "3px solid #082F58", borderRadius: 8, padding: 12, background: "#f8fafc" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#082F58", textTransform: "uppercase", marginBottom: 6 }}>
                        Opção {i + 1}{s.rotulo ? ` · ${s.rotulo}` : ""}
                      </div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "#0f172a", whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto" }}>{fill(s.texto)}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <button onClick={() => copiar(s)}
                          style={{ flex: 1, padding: "8px", background: copiedId === s.id ? "#166534" : "#e2e8f0", color: copiedId === s.id ? "#fff" : "#082F58", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {copiedId === s.id ? "✓ Copiado" : "Copiar"}
                        </button>
                        <button onClick={() => enviar(s)} disabled={!activeWa}
                          title={activeWa ? "Enviar no WhatsApp" : "Selecione uma conversa"}
                          style={{ flex: 1, padding: "8px", background: sentId === s.id ? "#166534" : !activeWa ? "#cbd5e1" : "#25D366", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: !activeWa ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                          {sentId === s.id ? "✓ Enviado" : "Enviar direto"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 16, border: "1px dashed #e2e8f0", borderRadius: 8 }}>
                  Escolha uma fase, objeção ou situação para ver os scripts.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{children}</div>;
}
function Chips({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>{children}</div>;
}
function Chip({ children, on, danger, warn, onClick }: { children: React.ReactNode; on: boolean; danger?: boolean; warn?: boolean; onClick: () => void }) {
  const onBg = danger ? "#fef2f2" : warn ? "#fffbeb" : "#FBB814";
  const onBd = danger ? "#dc2626" : warn ? "#d97706" : "#FBB814";
  const onCol = danger ? "#b91c1c" : warn ? "#92400e" : "#082F58";
  return (
    <button onClick={onClick}
      style={{ padding: "6px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        border: `1px solid ${on ? onBd : "#e2e8f0"}`, background: on ? onBg : "#fff", color: on ? onCol : "#64748b" }}>
      {children}
    </button>
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
