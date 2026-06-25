"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/auth/users";
import HojePanel     from "@/components/HojePanel";
import AmanhaPanel   from "@/components/AmanhaPanel";
import OficinaPanel  from "@/components/OficinaPanel";
import ConversasPanel from "@/components/ConversasPanel";
import ScriptsPanel  from "@/components/ScriptsPanel";
import AdmPanel      from "@/components/AdmPanel";

interface User { email: string; name: string; role: Role }

type Tab = "hoje" | "amanha" | "oficina" | "conversas" | "scripts" | "adm";

const TABS: { id: Tab; label: string; icon: string; minRole?: Role }[] = [
  { id: "hoje",      label: "Hoje",            icon: "📅" },
  { id: "amanha",    label: "Amanhã",          icon: "📆" },
  { id: "oficina",   label: "Oficina ao vivo", icon: "🔧" },
  { id: "conversas", label: "Conversas",       icon: "💬" },
  { id: "scripts",   label: "Scripts",         icon: "📄" },
  { id: "adm",       label: "ADM",             icon: "⚙️", minRole: "gestao" },
];

const ROLE_ORDER: Record<Role, number> = { admin: 0, gestao: 1, qualidade: 2 };

function canSeeTab(userRole: Role, minRole?: Role): boolean {
  if (!minRole) return true;
  return ROLE_ORDER[userRole] <= ROLE_ORDER[minRole];
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
    borderBottom: active ? "2px solid #FBB814" : "2px solid transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.55)",
    background: "none", border: "none",
    fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
  };
}

export default function Home() {
  const router            = useRouter();
  const [user, setUser]   = useState<User | null>(null);
  const [tab,  setTab]    = useState<Tab>("hoje");
  const [store, setStore] = useState<"CGR" | "TEM">("CGR");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(({ user }) => {
        if (!user) { router.push("/login"); return; }
        setUser(user);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#64748b", fontSize: 14 }}>Carregando...</span>
      </div>
    );
  }

  const initials    = user.name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("");
  const visibleTabs = TABS.filter(t => canSeeTab(user.role, t.minRole));

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "var(--font-manrope), sans-serif" }}>
      {/* Topbar */}
      <div style={{
        background: "#082F58", height: 52, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 20px",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, background: "#FBB814", borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>🔧</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
            Mapa da <span style={{ color: "#FBB814" }}>Qualidade</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => setStore(s => s === "CGR" ? "TEM" : "CGR")}
            style={{
              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 6, padding: "4px 10px", color: "#fff", fontSize: 12,
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            🏪 {store === "CGR" ? "CGR — Campo Grande" : "TEM — Barretos"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", background: "#FBB814",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: "#082F58",
            }}>{initials}</div>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
              {user.name.split(" ")[0]}
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.5)",
              fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            }}
          >Sair</button>
        </div>
      </div>

      {/* Tabbar */}
      <div style={{
        background: "#082F58", padding: "0 20px", display: "flex", gap: 2,
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>
        {tab === "hoje"    && <HojePanel    store={store} />}
        {tab === "amanha"  && <AmanhaPanel  store={store} />}
        {tab === "oficina" && <OficinaPanel store={store} />}
        {tab === "conversas" && <ConversasPanel user={user} store={store} />}
        {tab === "scripts" && <ScriptsPanel user={user} />}
        {tab === "adm"     && <AdmPanel     user={user} />}
      </div>
    </div>
  );
}
