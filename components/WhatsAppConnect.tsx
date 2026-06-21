"use client";

import { useState, useEffect } from "react";
import type { Role } from "@/lib/auth/users";

interface AttendantLink {
  email: string;
  phoneNumberId: string;
  displayNumber: string;
  status: string;
  connectedAt?: number;
}

interface Props { user: { email: string; role: Role } }

// Conexão do número via Coexistência. Quando o app Meta estiver configurado
// (NEXT_PUBLIC_META_APP_ID), o botão dispara o Embedded Signup. Enquanto isso,
// há um formulário manual para conectar um número de teste.
export default function WhatsAppConnect({ user }: Props) {
  const [mine, setMine] = useState<AttendantLink | null>(null);
  const [all,  setAll]  = useState<AttendantLink[]>([]);
  const [loading, setLoading] = useState(true);

  // formulário manual (fallback / teste)
  const [pnId,  setPnId]  = useState("");
  const [waba,  setWaba]  = useState("");
  const [disp,  setDisp]  = useState("");
  const [saving, setSaving] = useState(false);
  const [msg,   setMsg]   = useState("");

  const isManager = user.role === "admin" || user.role === "gestao";
  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID;

  function load() {
    fetch("/api/whatsapp/connect")
      .then(r => r.json())
      .then(d => { setMine(d.mine ?? null); setAll(d.all ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(load, []);

  async function connectManual(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const r = await fetch("/api/whatsapp/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumberId: pnId.trim(), wabaId: waba.trim(), displayNumber: disp.trim() }),
    });
    const d = await r.json();
    if (r.ok) { setMsg("✅ Número conectado!"); setPnId(""); setWaba(""); setDisp(""); load(); }
    else setMsg(`❌ ${d.error ?? "Erro ao conectar"}`);
    setSaving(false);
  }

  if (loading) return <div style={{ color: "#94a3b8", fontSize: 13 }}>Carregando...</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Status do meu número */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Meu WhatsApp</div>
        {mine ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#16a34a" }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                {mine.displayNumber || mine.phoneNumberId}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Conectado · Coexistência ativa</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#64748b" }}>Você ainda não conectou um número.</div>
        )}
      </div>

      {/* Conectar */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Conectar meu WhatsApp Business</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
          Mantenha o número no app <strong>WhatsApp Business</strong> e habilite a Coexistência durante o processo —
          você continua usando o celular normalmente.
        </div>

        {metaAppId ? (
          <button
            onClick={() => alert("Embedded Signup será iniciado quando o app Meta estiver homologado.")}
            style={{ padding: "11px 18px", background: "#25D366", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            📱 Conectar via Embedded Signup
          </button>
        ) : (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
            ⏳ O Embedded Signup da Meta ainda não está configurado (Fase 0 pendente).
            Use o formulário manual abaixo para conectar um número de teste.
          </div>
        )}

        {/* Formulário manual de teste */}
        <form onSubmit={connectManual} style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Phone Number ID" value={pnId} onChange={setPnId} placeholder="ex: 123456789012345" required />
          <Field label="WABA ID" value={waba} onChange={setWaba} placeholder="ex: 987654321098765" required />
          <Field label="Número exibido (opcional)" value={disp} onChange={setDisp} placeholder="ex: +55 67 9...." />
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" disabled={saving}
              style={{ padding: "9px 16px", background: saving ? "#94a3b8" : "#082F58", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {saving ? "Conectando..." : "Conectar número"}
            </button>
          </div>
        </form>
        {msg && (
          <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 8, fontSize: 12,
            background: msg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
            color: msg.startsWith("✅") ? "#15803d" : "#b91c1c",
            border: `1px solid ${msg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}` }}>
            {msg}
          </div>
        )}
      </div>

      {/* Visão do gestor — todos os números */}
      {isManager && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 14 }}>
            Números conectados ({all.length})
          </div>
          {all.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Nenhum número conectado ainda.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Atendente", "Número", "Status"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {all.map(a => (
                  <tr key={a.phoneNumberId} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", color: "#0f172a" }}>{a.email}</td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{a.displayNumber || a.phoneNumberId}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ {a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}
