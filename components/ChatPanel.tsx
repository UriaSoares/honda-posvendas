"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface ActiveConv {
  wa: string;
  phoneNumberId: string;
  nome: string;
  janelaAberta: boolean;
}

interface WaContact {
  wa: string;
  nome: string;
  ultimaMsg: string;
  ultimaMsgAt: number;
  naoLidas: number;
  janela24hExpiraEm: number;
}

interface WaMessage {
  id: string;
  direction: "in" | "out";
  type: "text" | "template";
  body: string;
  timestamp: number;
  status?: string;
}

interface AttendantLink {
  email: string;
  phoneNumberId: string;
  displayNumber: string;
  status: string;
}

interface Props {
  isManager: boolean;
  reloadKey?: number;
  onActiveChange?: (conv: ActiveConv | null) => void;
}

const POLL_MS = 4000;

export default function ChatPanel({ isManager, reloadKey, onActiveChange }: Props) {
  const [mine,    setMine]    = useState<AttendantLink | null>(null);
  const [all,     setAll]     = useState<AttendantLink[]>([]);
  const [phone,   setPhone]   = useState<string | null>(null);
  const [inbox,   setInbox]   = useState<WaContact[]>([]);
  const [activeWa, setActiveWa] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [janela,  setJanela]  = useState(false);
  const [text,    setText]    = useState("");
  const [sending, setSending] = useState(false);
  const [loaded,  setLoaded]  = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // status de conexão (quem tem número)
  useEffect(() => {
    fetch("/api/whatsapp/connect")
      .then(r => r.json())
      .then(d => {
        setMine(d.mine ?? null);
        setAll(d.all ?? []);
        setPhone(d.mine?.phoneNumberId ?? d.all?.[0]?.phoneNumberId ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const loadInbox = useCallback(async (pn: string) => {
    const r = await fetch(`/api/whatsapp/inbox?phoneNumberId=${encodeURIComponent(pn)}`);
    if (!r.ok) return;
    const d = await r.json();
    setInbox(d.inbox ?? []);
  }, []);

  const loadThread = useCallback(async (pn: string, wa: string) => {
    const r = await fetch(`/api/whatsapp/thread?phoneNumberId=${encodeURIComponent(pn)}&wa=${encodeURIComponent(wa)}`);
    if (!r.ok) return;
    const d = await r.json();
    setMessages(d.messages ?? []);
    setJanela(!!d.janelaAberta);
    onActiveChange?.({ wa, phoneNumberId: pn, nome: d.contact?.nome ?? wa, janelaAberta: !!d.janelaAberta });
  }, [onActiveChange]);

  // polling
  useEffect(() => {
    if (!phone) return;
    loadInbox(phone);
    if (activeWa) loadThread(phone, activeWa);
    const id = setInterval(() => {
      loadInbox(phone);
      if (activeWa) loadThread(phone, activeWa);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [phone, activeWa, loadInbox, loadThread]);

  // reload externo (ex: script enviado pela tela de Scripts)
  useEffect(() => {
    if (phone && activeWa) loadThread(phone, activeWa);
  }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function selectConv(wa: string) {
    setActiveWa(wa);
    if (phone) loadThread(phone, wa);
  }

  async function send() {
    if (!text.trim() || !phone || !activeWa) return;
    setSending(true);
    try {
      const r = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wa: activeWa, phoneNumberId: phone, body: text.trim() }),
      });
      if (r.ok) {
        setText("");
        await loadThread(phone, activeWa);
      }
    } finally {
      setSending(false);
    }
  }

  // ── Estados vazios ──
  if (!loaded) {
    return <Shell><Empty icon="⏳" text="Carregando WhatsApp..." /></Shell>;
  }
  if (!mine && all.length === 0) {
    return (
      <Shell>
        <Empty
          icon="📱"
          text="Nenhum número conectado."
          sub="Conecte seu WhatsApp Business no painel ADM para começar."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Seletor de número (gestor) */}
      {isManager && all.length > 1 && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <select
            value={phone ?? ""}
            onChange={e => { setPhone(e.target.value); setActiveWa(null); setMessages([]); }}
            style={{ width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
          >
            {all.map(a => (
              <option key={a.phoneNumberId} value={a.phoneNumberId}>
                {a.email} {a.displayNumber ? `· ${a.displayNumber}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Inbox */}
        <div style={{ width: 130, flexShrink: 0, borderRight: "1px solid #e2e8f0", overflowY: "auto" }}>
          {inbox.length === 0 ? (
            <div style={{ padding: 12, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
              Sem conversas
            </div>
          ) : inbox.map(c => {
            const active = c.wa === activeWa;
            return (
              <button
                key={c.wa}
                onClick={() => selectConv(c.wa)}
                style={{
                  width: "100%", textAlign: "left", padding: "8px 10px", border: "none",
                  borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontFamily: "inherit",
                  background: active ? "#eff6ff" : "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>
                    {c.nome}
                  </span>
                  {c.naoLidas > 0 && (
                    <span style={{ background: "#16a34a", color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "1px 5px" }}>
                      {c.naoLidas}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.ultimaMsg}
                </div>
              </button>
            );
          })}
        </div>

        {/* Thread */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!activeWa ? (
            <Empty icon="💬" text="Selecione uma conversa" />
          ) : (
            <>
              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 10, background: "#f8fafc", display: "flex", flexDirection: "column", gap: 6 }}>
                {messages.map((m, i) => (
                  <div key={m.id + i} style={{ alignSelf: m.direction === "out" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                    <div style={{
                      padding: "7px 10px", borderRadius: 10, fontSize: 12, lineHeight: 1.45,
                      background: m.direction === "out" ? "#082F58" : "#fff",
                      color: m.direction === "out" ? "#fff" : "#0f172a",
                      border: m.direction === "out" ? "none" : "1px solid #e2e8f0",
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {m.type === "template" && (
                        <div style={{ fontSize: 9, opacity: 0.7, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          📋 Script
                        </div>
                      )}
                      {m.body}
                    </div>
                    <div style={{ fontSize: 9, color: "#94a3b8", textAlign: m.direction === "out" ? "right" : "left", marginTop: 2 }}>
                      {new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Caixa de envio */}
              {janela ? (
                <div style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid #e2e8f0" }}>
                  <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") send(); }}
                    placeholder="Digite uma mensagem..."
                    style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                  />
                  <button
                    onClick={send} disabled={sending || !text.trim()}
                    style={{
                      padding: "8px 14px", background: sending || !text.trim() ? "#cbd5e1" : "#082F58",
                      color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: sending || !text.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
                    }}
                  >➤</button>
                </div>
              ) : (
                <div style={{ padding: "10px 12px", borderTop: "1px solid #e2e8f0", background: "#fffbeb", fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
                  ⏳ Janela de 24h fechada. Para reabrir, dispare um <strong>script aprovado</strong> usando o botão <strong>Enviar</strong> ao lado do roteiro.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", background: "#082F58", display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 14 }}>💬</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>WhatsApp ao vivo</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 30, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{text}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, maxWidth: 200 }}>{sub}</div>}
    </div>
  );
}
