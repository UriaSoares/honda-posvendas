"use client";

import { useState, FormEvent } from "react";
import { useRouter }           from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [current,  setCurrent]  = useState("");
  const [newPwd,   setNewPwd]   = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [isFirst,  setIsFirst]  = useState<boolean | null>(null);

  // Detecta se é primeiro acesso via session
  useState(() => {
    fetch("/api/auth/me").then(r => r.json()).then(({ user }) => {
      setIsFirst(user?.mustChangePassword ?? false);
    }).catch(() => setIsFirst(false));
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPwd !== confirm) { setError("As senhas não coincidem."); return; }
    if (newPwd.length < 6)  { setError("A senha deve ter pelo menos 6 caracteres."); return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: current || undefined, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao alterar senha."); return; }
      router.push("/");
      router.refresh();
    } catch {
      setError("Falha na conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    border: "1.5px solid #e2e8f0", borderRadius: 8,
    fontSize: 14, color: "#0f172a", outline: "none",
    background: "#fff", fontFamily: "'Manrope', sans-serif",
    boxSizing: "border-box", transition: "border-color 0.15s",
  };

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif", minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <img src="/logo-caioba.png" alt="Caiobá Honda" style={{ height: 36, objectFit: "contain" }} />
        </div>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
            {isFirst ? "Crie sua senha" : "Alterar senha"}
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            {isFirst
              ? "Por segurança, defina uma senha pessoal antes de continuar."
              : "Digite sua senha atual e escolha uma nova."}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!isFirst && (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Senha atual
              </label>
              <input
                type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
                placeholder="••••••••" required={!isFirst} style={inp}
                onFocus={(e) => { e.target.style.borderColor = "#082F58"; }}
                onBlur={(e)  => { e.target.style.borderColor = "#e2e8f0"; }}
              />
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Nova senha
            </label>
            <input
              type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Mínimo 6 caracteres" required style={inp}
              onFocus={(e) => { e.target.style.borderColor = "#082F58"; }}
              onBlur={(e)  => { e.target.style.borderColor = "#e2e8f0"; }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Confirmar nova senha
            </label>
            <input
              type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a senha" required style={inp}
              onFocus={(e) => { e.target.style.borderColor = "#082F58"; }}
              onBlur={(e)  => { e.target.style.borderColor = "#e2e8f0"; }}
            />
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", padding: "13px",
              background: loading ? "#94a3b8" : "#082F58",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'Manrope', sans-serif", transition: "background 0.15s", marginTop: 4,
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#106080"; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#082F58"; }}
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
