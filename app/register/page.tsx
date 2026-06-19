"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams }               from "next/navigation";

function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [pwd,     setPwd]     = useState("");
  const [confirm, setConfirm] = useState("");
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready,   setReady]   = useState(false);

  useEffect(() => {
    if (!token) { setError("Link inválido ou expirado."); return; }
    // Busca dados do convite
    fetch(`/api/auth/register?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error ?? "Link inválido."); return; }
        setName(d.name);
        setEmail(d.email);
        setReady(true);
      })
      .catch(() => setError("Falha ao carregar convite."));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pwd !== confirm) { setError("As senhas não coincidem."); return; }
    if (pwd.length < 6)  { setError("A senha deve ter pelo menos 6 caracteres."); return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password: pwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao criar conta."); return; }
      router.push("/login?registered=1");
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
    boxSizing: "border-box",
  };

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif", minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <img src="/logo-caioba.png" alt="Caiobá Honda" style={{ height: 36, objectFit: "contain" }} />
        </div>

        {error && !ready ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "16px", fontSize: 14, color: "#dc2626", marginBottom: 16 }}>
              {error}
            </div>
            <p style={{ fontSize: 13, color: "#64748b" }}>Entre em contato com seu gerente para um novo convite.</p>
          </div>
        ) : !ready ? (
          <p style={{ textAlign: "center", color: "#64748b", fontSize: 14 }}>Carregando convite...</p>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
                Criar sua conta
              </h1>
              <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
                Olá, <strong>{name.split(" ")[0].charAt(0) + name.split(" ")[0].slice(1).toLowerCase()}</strong>! Escolha uma senha para acessar o sistema.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>E-mail</label>
                <input type="email" value={email} disabled style={{ ...inp, background: "#f1f5f9", color: "#94a3b8" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Nova senha</label>
                <input
                  type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required style={inp}
                  onFocus={(e) => { e.target.style.borderColor = "#082F58"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "#e2e8f0"; }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Confirmar senha</label>
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
                  fontFamily: "'Manrope', sans-serif", marginTop: 4,
                }}
              >
                {loading ? "Criando conta..." : "Criar conta e entrar"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
