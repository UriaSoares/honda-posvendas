"use client";

import { useState, useEffect } from "react";

interface PromoSlot { titulo: string; texto: string; imagem: string; upload: boolean }

const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

export default function PromoConfig() {
  const [slots, setSlots] = useState<PromoSlot[]>([]);
  const [atual, setAtual] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  function load() {
    fetch("/api/admin/promo").then(r => r.json()).then(d => {
      setSlots(d.promo?.slots ?? []); setAtual(d.atual ?? null);
    }).catch(() => {});
  }
  useEffect(load, []);

  function patch(i: number, fn: (s: PromoSlot) => void) {
    setSlots(prev => prev.map((s, j) => { if (j !== i) return s; const c = { ...s }; fn(c); return c; }));
  }

  async function upload(i: number, file: File) {
    if (file.size > 1_000_000) { setMsg("❌ Imagem muito grande (máx ~1MB). Otimize antes."); return; }
    setBusy(i); setMsg("");
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file);
    });
    const r = await fetch("/api/admin/promo/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot: i, dataUrl }) });
    if (r.ok) { patch(i, s => { s.upload = true; s.imagem = ""; }); setMsg(`✅ Imagem do slot ${i + 1} enviada. Não esqueça de salvar.`); }
    else { const d = await r.json(); setMsg(`❌ ${d.error ?? "Erro no upload"}`); }
    setBusy(null);
  }

  async function save() {
    setSaving(true); setMsg("");
    const r = await fetch("/api/admin/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots }) });
    const d = await r.json();
    if (r.ok) { setMsg("✅ Promoções salvas!"); load(); } else setMsg(`❌ ${d.error ?? "Erro ao salvar"}`);
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#1e40af", lineHeight: 1.5 }}>
        📅 Programe até <strong>4 promoções</strong>. O telão exibe <strong>uma por semana</strong>, avançando automaticamente. O título é só pra você identificar — não aparece no telão.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {[0, 1, 2, 3].map(i => {
          const s = slots[i] ?? { titulo: "", texto: "", imagem: "", upload: false };
          const noAr = atual === i;
          const src = s.upload ? `/api/display/promo-img/${i}?t=${Date.now()}` : s.imagem;
          return (
            <div key={i} style={{ background: "#fff", border: `1px solid ${noAr ? "#FBB814" : "#e2e8f0"}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Semana / Slot {i + 1}</span>
                {noAr && <span style={{ fontSize: 10, fontWeight: 700, background: "#FBB814", color: "#663d00", borderRadius: 20, padding: "2px 10px" }}>NO AR</span>}
              </div>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={s.titulo} placeholder="Título (só p/ controle)" onChange={e => patch(i, x => { x.titulo = e.target.value; })} style={{ ...inp, fontWeight: 600 }} />

                {/* preview */}
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" style={{ width: "100%", height: 120, objectFit: "contain", background: "#f8fafc", borderRadius: 8, border: "1px solid #f1f5f9" }} />
                ) : (
                  <div style={{ height: 120, background: "#f8fafc", borderRadius: 8, border: "1px dashed #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: 12 }}>sem imagem</div>
                )}

                <input value={s.upload ? "" : s.imagem} placeholder="URL da imagem (https://…)" disabled={s.upload}
                  onChange={e => patch(i, x => { x.imagem = e.target.value; x.upload = false; })} style={inp} />

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b", cursor: "pointer" }}>
                  <span style={{ padding: "6px 12px", background: "#e2e8f0", borderRadius: 7, fontWeight: 700, color: "#082F58" }}>{busy === i ? "Enviando…" : "📤 Enviar imagem"}</span>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(i, f); e.target.value = ""; }} />
                  {s.upload && <button onClick={() => patch(i, x => { x.upload = false; })} style={{ background: "none", border: "none", color: "#b91c1c", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>remover</button>}
                </label>

                <textarea value={s.texto} placeholder="Texto opcional (aparece abaixo da imagem)" rows={2}
                  onChange={e => patch(i, x => { x.texto = e.target.value; })} style={{ ...inp, resize: "vertical" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
        <button onClick={save} disabled={saving}
          style={{ padding: "11px 20px", background: saving ? "#94a3b8" : "#082F58", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {saving ? "Salvando..." : "Salvar promoções"}
        </button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith("✅") ? "#15803d" : "#b91c1c" }}>{msg}</span>}
      </div>
    </div>
  );
}
