"use client";

import { useState, useEffect } from "react";
import type { Role } from "@/lib/auth/users";

interface User { email: string; name: string; role: Role }
interface Props { user: User }

interface UserRecord {
  email: string; name: string; role: Role; mustChangePassword?: boolean;
}

interface Promo {
  title: string; body: string; updatedAt?: string;
}

const ROLE_LABELS: Record<Role, string> = {
  admin:     "Admin",
  gestao:    "Gestão",
  qualidade: "Qualidade",
};

export default function AdmPanel({ user }: Props) {
  const [tab, setTab] = useState<"users" | "promo">("users");

  // Users
  const [users,    setUsers]    = useState<UserRecord[]>([]);
  const [uLoading, setULoading] = useState(true);
  const [uError,   setUError]   = useState("");

  // Invite
  const [iEmail,  setIEmail]  = useState("");
  const [iName,   setIName]   = useState("");
  const [iRole,   setIRole]   = useState<Role>("qualidade");
  const [iSending, setISending] = useState(false);
  const [iMsg,    setIMsg]    = useState("");

  // Promo
  const [promo,    setPromo]    = useState<Promo>({ title: "", body: "" });
  const [pLoading, setPLoading] = useState(true);
  const [pSaving,  setPSaving]  = useState(false);
  const [pMsg,     setPMsg]     = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setULoading(false); })
      .catch(() => { setUError("Erro ao carregar usuários"); setULoading(false); });
  }, []);

  useEffect(() => {
    fetch("/api/admin/promo")
      .then(r => r.json())
      .then(d => { setPromo(d.promo ?? { title: "", body: "" }); setPLoading(false); })
      .catch(() => setPLoading(false));
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setISending(true); setIMsg("");
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: iEmail, name: iName, role: iRole, password: "Trocar@2026" }),
    });
    const d = await r.json();
    if (r.ok) {
      setIMsg(`✅ Usuário ${iName} criado. Senha provisória: Trocar@2026`);
      setIEmail(""); setIName("");
      const ru = await fetch("/api/admin/users");
      const du = await ru.json();
      setUsers(du.users ?? []);
    } else {
      setIMsg(`❌ ${d.error ?? "Erro ao criar usuário"}`);
    }
    setISending(false);
  }

  async function handleSavePromo(e: React.FormEvent) {
    e.preventDefault();
    setPSaving(true); setPMsg("");
    const r = await fetch("/api/admin/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(promo),
    });
    const d = await r.json();
    setPMsg(r.ok ? "✅ Promoção salva!" : `❌ ${d.error ?? "Erro ao salvar"}`);
    setPSaving(false);
  }

  const tabBtn = (id: "users" | "promo", label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: "8px 16px", border: "none", cursor: "pointer",
        background: tab === id ? "#082F58" : "transparent",
        color: tab === id ? "#fff" : "#64748b",
        borderRadius: 7, fontWeight: 600, fontSize: 13, fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#082F58", marginBottom: 16 }}>
        Administração — <span style={{ color: "#FBB814" }}>Mapa da Qualidade</span>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f1f5f9", borderRadius: 9, padding: 4, width: "fit-content" }}>
        {tabBtn("users", "👥 Usuários")}
        {tabBtn("promo", "📢 Promoção da semana")}
      </div>

      {/* ── USERS ── */}
      {tab === "users" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
          {/* List */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 14 }}>
              Usuários do sistema
            </div>
            {uError && <div style={{ padding: "12px 18px", color: "#b91c1c", fontSize: 13 }}>{uError}</div>}
            {uLoading ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Carregando...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Nome", "E-mail", "Perfil", "Status"].map(h => (
                      <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.email} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0f172a" }}>{u.name}</td>
                      <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>{u.email}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: u.role === "admin" ? "#fef3c7" : u.role === "gestao" ? "#e0e7ff" : "#f0fdf4",
                          color:      u.role === "admin" ? "#92400e" : u.role === "gestao" ? "#3730a3" : "#15803d",
                        }}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {u.mustChangePassword ? (
                          <span style={{ fontSize: 11, color: "#d97706", fontWeight: 600 }}>⚠ Trocar senha</span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ Ativo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Invite */}
          {user.role === "admin" && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Convidar novo usuário</div>
              <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Nome completo</label>
                  <input value={iName} onChange={e => setIName(e.target.value)} required placeholder="Ex: Maria Fernanda"
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>E-mail</label>
                  <input value={iEmail} onChange={e => setIEmail(e.target.value)} type="email" required placeholder="maria@grupocaioba.com.br"
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Perfil de acesso</label>
                  <select value={iRole} onChange={e => setIRole(e.target.value as Role)}
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff" }}>
                    <option value="qualidade">Qualidade</option>
                    <option value="gestao">Gestão</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" disabled={iSending}
                  style={{
                    padding: "10px", background: iSending ? "#94a3b8" : "#082F58",
                    color: "#fff", border: "none", borderRadius: 8,
                    fontSize: 14, fontWeight: 700, cursor: iSending ? "not-allowed" : "pointer", fontFamily: "inherit",
                  }}>
                  {iSending ? "Criando..." : "Criar usuário"}
                </button>
                {iMsg && (
                  <div style={{
                    padding: "9px 12px", borderRadius: 8, fontSize: 12,
                    background: iMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
                    color:      iMsg.startsWith("✅") ? "#15803d" : "#b91c1c",
                    border:     `1px solid ${iMsg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`,
                  }}>{iMsg}</div>
                )}
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── PROMO ── */}
      {tab === "promo" && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Promoção exibida no telão da recepção</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
              Este texto aparece no 3º slide da tela <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4 }}>/display</code>.
            </div>
            {pLoading ? (
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Carregando...</div>
            ) : (
              <form onSubmit={handleSavePromo} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Título</label>
                  <input value={promo.title} onChange={e => setPromo(p => ({ ...p, title: e.target.value }))}
                    placeholder="Ex: Revisão Honda com 10% OFF em peças!"
                    style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Mensagem</label>
                  <textarea value={promo.body} onChange={e => setPromo(p => ({ ...p, body: e.target.value }))}
                    rows={5} placeholder="Descreva a promoção da semana aqui..."
                    style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
                </div>
                {/* Preview */}
                {(promo.title || promo.body) && (
                  <div style={{
                    background: "#082F58", borderRadius: 12, padding: 20, color: "#fff",
                    border: "2px solid #FBB814",
                  }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Preview no telão</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#FBB814", marginBottom: 8 }}>{promo.title || "Sem título"}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap" }}>{promo.body}</div>
                  </div>
                )}
                <button type="submit" disabled={pSaving}
                  style={{
                    padding: "11px", background: pSaving ? "#94a3b8" : "#082F58",
                    color: "#fff", border: "none", borderRadius: 8,
                    fontSize: 14, fontWeight: 700, cursor: pSaving ? "not-allowed" : "pointer", fontFamily: "inherit",
                  }}>
                  {pSaving ? "Salvando..." : "Salvar promoção"}
                </button>
                {pMsg && (
                  <div style={{
                    padding: "9px 12px", borderRadius: 8, fontSize: 12,
                    background: pMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
                    color:      pMsg.startsWith("✅") ? "#15803d" : "#b91c1c",
                    border:     `1px solid ${pMsg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`,
                  }}>{pMsg}</div>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
