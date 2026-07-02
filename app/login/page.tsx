"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Mulish, Saira } from "next/font/google";

const mulish = Mulish({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-mulish" });
const saira  = Saira({ subsets: ["latin"], weight: ["400", "700", "900"], style: ["normal", "italic"], variable: "--font-saira" });

const PILARES = [
  {
    cor: "#FBB814", bg: "rgba(251,184,20,.15)", border: "rgba(251,184,20,.3)",
    titulo: "Colaboração",
    desc: "Histórico do cliente acessível para vendas e oficina, sem barreiras entre equipes.",
    icone: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  },
  {
    cor: "#5B9FE8", bg: "rgba(16,96,176,.25)", border: "rgba(16,96,176,.4)",
    titulo: "Jornada completa",
    desc: "Do primeiro contato ao serviço expresso — o ciclo de vida do cliente em um só lugar.",
    icone: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  },
  {
    cor: "#F58220", bg: "rgba(245,130,32,.15)", border: "rgba(245,130,32,.3)",
    titulo: "Fidelização",
    desc: "Na Caiobá a gente cumpre o que combina — e traz vantagem real ao cliente.",
    icone: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  },
];

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get("from") ?? "/";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [focused,  setFocused]  = useState("");
  const [hover,    setHover]    = useState<"btn" | "esqueci" | "telao" | null>(null);
  const [pressed,  setPressed]  = useState(false);

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

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%", padding: "14px 16px", borderRadius: 12,
    fontFamily: "var(--font-mulish), sans-serif", fontSize: 15, color: "#0F1115",
    border: "1.5px solid transparent", outline: "none", boxSizing: "border-box",
    transition: "border-color .15s, background .15s",
    background: focused === field ? "#fff" : "#EEF1F7",
    borderColor: focused === field ? "#1060B0" : "transparent",
  });

  return (
    <div className={`${mulish.variable} ${saira.variable}`} style={{ minHeight: "100vh", display: "flex", flexDirection: "row" }}>
      <style jsx global>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shimmer { 0%,100% { opacity: .07; } 50% { opacity: .13; } }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 40px #EEF1F7 inset !important; -webkit-text-fill-color: #0F1115 !important; }
      `}</style>

      {/* ── PAINEL ESQUERDO ── */}
      <div style={{
        flex: "0 0 52%", position: "relative", background: "#082F58", overflow: "hidden",
        display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 52px",
      }}>
        <div style={{ position: "absolute", top: -60, right: -80, width: 340, height: 700, background: "#FBB814", opacity: 0.08, transform: "rotate(18deg)", animation: "shimmer 5s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: -100, left: -60, width: 280, height: 500, background: "#1060B0", opacity: 0.18, transform: "rotate(18deg)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "linear-gradient(to bottom, #FBB814, #F58220)" }} />

        <div style={{ animation: "fadeUp .6s ease both", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 52 }}>
            <div style={{ width: 48, height: 48, background: "#1060B0", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, boxShadow: "0 4px 16px rgba(0,0,0,.25)" }}>🔧</div>
            <div>
              <div style={{ fontFamily: "var(--font-mulish), sans-serif", fontWeight: 800, fontSize: 18, color: "#fff", lineHeight: 1.1 }}>Caiobá Honda</div>
              <div style={{ fontFamily: "var(--font-mulish), sans-serif", fontWeight: 500, fontSize: 13, color: "#FBB814", letterSpacing: "0.04em" }}>Mapa da Qualidade</div>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "var(--font-saira), sans-serif", fontStyle: "italic", fontWeight: 900, fontSize: 46, lineHeight: 1.0, color: "#fff", textTransform: "uppercase", letterSpacing: "-0.01em" }}>
              Vendas &amp;<br />Oficina,<br /><span style={{ color: "#FBB814" }}>juntos.</span>
            </div>
          </div>

          <p style={{ fontFamily: "var(--font-mulish), sans-serif", fontSize: 15, lineHeight: 1.65, color: "rgba(255,255,255,.72)", maxWidth: 380, marginBottom: 44 }}>
            O <strong style={{ color: "#fff", fontWeight: 700 }}>Mapa da Qualidade</strong> conecta o pós-venda ao time comercial em tempo real — transformando cada revisão em uma oportunidade de fidelização e recompra.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {PILARES.map((p, i) => (
              <div key={p.titulo} style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                animation: `fadeUp .6s ${0.15 + i * 0.13}s ease both`, opacity: 0,
              }}>
                <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: p.bg, border: `1px solid ${p.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={p.cor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{p.icone}</svg>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mulish), sans-serif", fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 2 }}>{p.titulo}</div>
                  <div style={{ fontFamily: "var(--font-mulish), sans-serif", fontSize: 12, color: "rgba(255,255,255,.6)", lineHeight: 1.5 }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ animation: "fadeIn 1s .7s ease both", opacity: 0, position: "relative" }}>
          <div style={{ height: 1, background: "rgba(255,255,255,.12)", marginBottom: 20 }} />
          <p style={{ fontFamily: "var(--font-mulish), sans-serif", fontSize: 11, color: "rgba(255,255,255,.38)", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>
            Desacelere, seu bem maior é a vida.
          </p>
        </div>
      </div>

      {/* ── PAINEL DIREITO (form) ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 40px", background: "#F7F8FA" }}>
        <div style={{ width: "100%", maxWidth: 400, animation: "fadeUp .55s .2s ease both", opacity: 0 }}>
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontFamily: "var(--font-mulish), sans-serif", fontWeight: 800, fontSize: 30, color: "#082F58", marginBottom: 8, lineHeight: 1.15 }}>Bem-vindo de volta</h1>
            <p style={{ fontFamily: "var(--font-mulish), sans-serif", fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>Entre com seu e-mail e senha para acessar o portal.</p>
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#b91c1c", marginBottom: 16, fontFamily: "var(--font-mulish), sans-serif" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mulish), sans-serif", fontSize: 13, fontWeight: 700, color: "#082F58", marginBottom: 8, letterSpacing: "0.01em" }}>E-mail</label>
                <input
                  type="email" autoComplete="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused("email")} onBlur={() => setFocused("")}
                  placeholder="seu@grupocaioba.com.br"
                  style={inputStyle("email")}
                />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontFamily: "var(--font-mulish), sans-serif", fontSize: 13, fontWeight: 700, color: "#082F58", letterSpacing: "0.01em" }}>Senha</label>
                  <a href="#"
                    onMouseEnter={() => setHover("esqueci")} onMouseLeave={() => setHover(null)}
                    style={{ fontFamily: "var(--font-mulish), sans-serif", fontSize: 12, color: "#1060B0", fontWeight: 600, textDecoration: hover === "esqueci" ? "underline" : "none" }}>
                    Esqueci a senha
                  </a>
                </div>
                <input
                  type="password" autoComplete="current-password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused("pass")} onBlur={() => setFocused("")}
                  placeholder="••••••••••"
                  style={inputStyle("pass")}
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              onMouseEnter={() => setHover("btn")} onMouseLeave={() => { setHover(null); setPressed(false); }}
              onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
              style={{
                width: "100%", padding: 16, color: "#fff", border: "none", borderRadius: 999,
                fontFamily: "var(--font-mulish), sans-serif", fontSize: 15, fontWeight: 800, letterSpacing: "0.04em",
                textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer",
                transition: "background .15s, transform .1s, box-shadow .15s",
                transform: pressed ? "scale(0.97)" : "scale(1)",
                background: loading ? "#94a3b8" : hover === "btn" ? "#1060B0" : "#082F58",
                boxShadow: hover === "btn" ? "0 6px 24px rgba(16,96,176,.4)" : "0 4px 18px rgba(8,47,88,.3)",
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: "100%", height: 1, background: "#E4E7ED" }} />
            <a href="/display"
              onMouseEnter={() => setHover("telao")} onMouseLeave={() => setHover(null)}
              style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mulish), sans-serif", fontSize: 13, color: "#1060B0", fontWeight: 600, textDecoration: hover === "telao" ? "underline" : "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
              Abrir tela de recepção (telão)
            </a>
          </div>
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
