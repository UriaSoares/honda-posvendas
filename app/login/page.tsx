"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const C = {
  wrap: {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: "#f8fafc", padding: "20px",
  } as React.CSSProperties,
  card: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16,
    padding: "40px 36px", width: "100%", maxWidth: 400,
    boxShadow: "0 4px 24px rgba(8,47,88,0.08)",
  } as React.CSSProperties,
  logo: {
    display: "flex", alignItems: "center", gap: 12, marginBottom: 32,
  } as React.CSSProperties,
  logoBox: {
    width: 44, height: 44, background: "#082F58", borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
  } as React.CSSProperties,
  logoIcon: { fontSize: 22, color: "#FBB814" } as React.CSSProperties,
  logoText: { lineHeight: 1.2 } as React.CSSProperties,
  logoTitle: { fontSize: 16, fontWeight: 800, color: "#082F58" } as React.CSSProperties,
  logoSub: { fontSize: 12, color: "#64748b" } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 6 } as React.CSSProperties,
  sub: { fontSize: 14, color: "#64748b", marginBottom: 28 } as React.CSSProperties,
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 } as React.CSSProperties,
  input: {
    width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0",
    borderRadius: 8, fontSize: 14, color: "#0f172a", outline: "none",
    background: "#fff", fontFamily: "inherit", boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
  } as React.CSSProperties,
  inputFocus: { borderColor: "#082F58" } as React.CSSProperties,
  group: { marginBottom: 18 } as React.CSSProperties,
  btn: {
    width: "100%", padding: "13px", background: "#082F58", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", marginTop: 8, transition: "background 0.15s",
  } as React.CSSProperties,
  btnDisabled: { background: "#94a3b8", cursor: "not-allowed" } as React.CSSProperties,
  error: {
    background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
    padding: "10px 14px", fontSize: 13, color: "#b91c1c", marginBottom: 16,
  } as React.CSSProperties,
  divider: { borderTop: "1px solid #e2e8f0", margin: "28px 0" } as React.CSSProperties,
  display: {
    display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
    fontSize: 13, color: "#64748b",
  } as React.CSSProperties,
};

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get("from") ?? "/";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [focused,  setFocused]  = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao fazer login."); return; }
      router.push(data.mustChangePassword ? "/change-password" : from);
      router.refresh();
    } catch {
      setError("Falha na conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={C.wrap}>
      <div style={C.card}>
        <div style={C.logo}>
          <div style={C.logoBox}>
            <span style={C.logoIcon}>🔧</span>
          </div>
          <div style={C.logoText}>
            <div style={C.logoTitle}>Caiobá Honda</div>
            <div style={C.logoSub}>Mapa da Qualidade</div>
          </div>
        </div>

        <h1 style={C.h1}>Bem-vindo</h1>
        <p style={C.sub}>Entre com seu e-mail e senha para acessar o portal.</p>

        {error && <div style={C.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={C.group}>
            <label style={C.label}>E-mail</label>
            <input
              type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocused("email")} onBlur={() => setFocused("")}
              placeholder="seu@email.com"
              style={{ ...C.input, ...(focused === "email" ? C.inputFocus : {}) }}
            />
          </div>
          <div style={C.group}>
            <label style={C.label}>Senha</label>
            <input
              type="password" autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocused("pass")} onBlur={() => setFocused("")}
              placeholder="••••••••"
              style={{ ...C.input, ...(focused === "pass" ? C.inputFocus : {}) }}
            />
          </div>
          <button
            type="submit" disabled={loading}
            style={{ ...C.btn, ...(loading ? C.btnDisabled : {}) }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div style={C.divider} />
        <div style={C.display}>
          <span>📺</span>
          <a href="/display" style={{ color: "#082F58", fontWeight: 600, textDecoration: "none" }}>
            Abrir tela de recepção (telão)
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
