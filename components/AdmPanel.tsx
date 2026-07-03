"use client";

import { useState, useEffect } from "react";
import type { Role, Loja } from "@/lib/auth/users";
import WhatsAppConnect from "@/components/WhatsAppConnect";
import ManutencaoSync from "@/components/ManutencaoSync";
import DisplayConfig from "@/components/DisplayConfig";
import PromoConfig from "@/components/PromoConfig";

interface User { email: string; name: string; role: Role }
interface Props { user: User }

interface UserRecord {
  email: string; name: string; role: Role; mustChangePassword?: boolean;
  active?: boolean; lojas?: Loja[]; whatsapp?: string;
}

const ROLE_LABELS: Record<Role, string> = {
  admin:     "Admin",
  gestao:    "Gestão",
  qualidade: "Qualidade",
};

const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 };

function LojaCheckboxes({ value, onChange }: { value: Loja[]; onChange: (v: Loja[]) => void }) {
  function toggle(l: Loja) {
    onChange(value.includes(l) ? value.filter(x => x !== l) : [...value, l]);
  }
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {(["CGR", "TEM"] as const).map(l => (
        <label key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}>
          <input type="checkbox" checked={value.includes(l)} onChange={() => toggle(l)} />
          {l === "CGR" ? "Campo Grande (CGR)" : "Barretos (TEM)"}
        </label>
      ))}
    </div>
  );
}

export default function AdmPanel({ user }: Props) {
  const [tab, setTab] = useState<"users" | "promo" | "whatsapp" | "manutencao" | "telao">("users");
  const isAdmin = user.role === "admin";

  // Users list
  const [users,    setUsers]    = useState<UserRecord[]>([]);
  const [uLoading, setULoading] = useState(true);
  const [uError,   setUError]   = useState("");

  // Invite form
  const [iEmail,  setIEmail]  = useState("");
  const [iName,   setIName]   = useState("");
  const [iRole,   setIRole]   = useState<Role>("qualidade");
  const [iLojas,  setILojas]  = useState<Loja[]>(["CGR"]);
  const [iSending, setISending] = useState(false);
  const [iMsg,    setIMsg]    = useState("");

  // Edit form (admin only)
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [eName, setEName]     = useState("");
  const [eEmail, setEEmail]   = useState("");
  const [eRole, setERole]     = useState<Role>("qualidade");
  const [eActive, setEActive] = useState(true);
  const [eWhats, setEWhats]   = useState("");
  const [eLojas, setELojas]   = useState<Loja[]>(["CGR"]);
  const [eSaving, setESaving] = useState(false);
  const [eMsg, setEMsg]       = useState("");

  function loadUsers() {
    setULoading(true);
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setULoading(false); })
      .catch(() => { setUError("Erro ao carregar usuários"); setULoading(false); });
  }
  useEffect(loadUsers, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setISending(true); setIMsg("");
    const r = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: iName, email: iEmail, role: iRole, lojas: iLojas }),
    });
    const d = await r.json();
    if (r.ok) {
      setIMsg(`✅ Usuário ${iName} criado. Senha provisória: ${d.defaultPassword}`);
      setIEmail(""); setIName(""); setIRole("qualidade"); setILojas(["CGR"]);
      loadUsers();
    } else {
      setIMsg(`❌ ${d.error ?? "Erro ao criar usuário"}`);
    }
    setISending(false);
  }

  function startEdit(u: UserRecord) {
    setEditing(u);
    setEName(u.name); setEEmail(u.email); setERole(u.role);
    setEActive(u.active ?? true); setEWhats(u.whatsapp ?? ""); setELojas(u.lojas ?? []);
    setEMsg("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setESaving(true); setEMsg("");
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit", email: editing.email,
        updates: { name: eName, email: eEmail, role: eRole, active: eActive, whatsapp: eWhats, lojas: eLojas },
      }),
    });
    const d = await r.json();
    if (r.ok) { setEMsg("✅ Usuário atualizado!"); loadUsers(); setTimeout(() => setEditing(null), 900); }
    else setEMsg(`❌ ${d.error ?? "Erro ao salvar"}`);
    setESaving(false);
  }

  const tabBtn = (id: "users" | "promo" | "whatsapp" | "manutencao" | "telao", label: string) => (
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
        {tabBtn("whatsapp", "💬 WhatsApp")}
        {tabBtn("manutencao", "🔧 Manutenção")}
        {tabBtn("telao", "📺 Telão")}
      </div>

      {/* ── WHATSAPP ── */}
      {tab === "whatsapp" && <WhatsAppConnect user={user} />}

      {/* ── MANUTENÇÃO ── */}
      {tab === "manutencao" && <ManutencaoSync />}

      {/* ── TELÃO ── */}
      {tab === "telao" && <DisplayConfig />}

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
                    {["Nome", "E-mail", "Perfil", "Lojas", "WhatsApp", "Status", isAdmin ? "" : null].filter((h): h is string => h !== null).map(h => (
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
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>
                        {u.role === "qualidade" ? (u.lojas ?? []).join(" / ") || "—" : "Todas"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{u.whatsapp || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {u.mustChangePassword ? (
                          <span style={{ fontSize: 11, color: "#d97706", fontWeight: 600 }}>⚠ Trocar senha</span>
                        ) : u.active === false ? (
                          <span style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>Inativo</span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ Ativo</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={{ padding: "10px 14px" }}>
                          <button onClick={() => startEdit(u)}
                            style={{ padding: "5px 11px", background: "#e2e8f0", color: "#082F58", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Invite / Edit */}
          {editing ? (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Editar usuário</div>
                <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕ fechar</button>
              </div>
              <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={lbl}>Nome completo</label>
                  <input value={eName} onChange={e => setEName(e.target.value)} required style={inp} />
                </div>
                <div>
                  <label style={lbl}>E-mail</label>
                  <input value={eEmail} onChange={e => setEEmail(e.target.value)} type="email" required style={inp} />
                </div>
                <div>
                  <label style={lbl}>Perfil de acesso</label>
                  <select value={eRole} onChange={e => setERole(e.target.value as Role)} style={{ ...inp, background: "#fff" }}>
                    <option value="qualidade">Qualidade</option>
                    <option value="gestao">Gestão</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {eRole === "qualidade" && (
                  <div>
                    <label style={lbl}>Lojas com acesso</label>
                    <LojaCheckboxes value={eLojas} onChange={setELojas} />
                  </div>
                )}
                <div>
                  <label style={lbl}>WhatsApp</label>
                  <input value={eWhats} onChange={e => setEWhats(e.target.value)} placeholder="(67) 99999-9999" style={inp} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", cursor: "pointer" }}>
                  <input type="checkbox" checked={eActive} onChange={e => setEActive(e.target.checked)} />
                  Usuário ativo
                </label>
                <button type="submit" disabled={eSaving}
                  style={{ padding: "10px", background: eSaving ? "#94a3b8" : "#082F58", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: eSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {eSaving ? "Salvando..." : "Salvar alterações"}
                </button>
                {eMsg && (
                  <div style={{ padding: "9px 12px", borderRadius: 8, fontSize: 12, background: eMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2", color: eMsg.startsWith("✅") ? "#15803d" : "#b91c1c", border: `1px solid ${eMsg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}` }}>{eMsg}</div>
                )}
              </form>
            </div>
          ) : (user.role === "admin" || user.role === "gestao") && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Convidar novo usuário</div>
              <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={lbl}>Nome completo</label>
                  <input value={iName} onChange={e => setIName(e.target.value)} required placeholder="Ex: Maria Fernanda" style={inp} />
                </div>
                <div>
                  <label style={lbl}>E-mail</label>
                  <input value={iEmail} onChange={e => setIEmail(e.target.value)} type="email" required placeholder="maria@grupocaioba.com.br" style={inp} />
                </div>
                {isAdmin ? (
                  <div>
                    <label style={lbl}>Perfil de acesso</label>
                    <select value={iRole} onChange={e => setIRole(e.target.value as Role)} style={{ ...inp, background: "#fff" }}>
                      <option value="qualidade">Qualidade</option>
                      <option value="gestao">Gestão</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Perfil: <strong>Qualidade</strong> — Gestão só pode convidar usuários deste tipo.
                  </div>
                )}
                {iRole === "qualidade" && (
                  <div>
                    <label style={lbl}>Lojas com acesso</label>
                    <LojaCheckboxes value={iLojas} onChange={setILojas} />
                  </div>
                )}
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
      {tab === "promo" && <PromoConfig />}
    </div>
  );
}
