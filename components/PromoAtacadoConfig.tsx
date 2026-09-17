"use client";

import { useState, useEffect, useCallback } from "react";

interface Slot { titulo: string; descricao: string; imagem: string; upload: boolean; inicio: string; fim: string; textos: string[] }
type Loja = "CGR" | "TEM";
const LOJA_NOME: Record<Loja, string> = { CGR: "Campo Grande", TEM: "Barretos" };
const LIMITE = 400;

const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

export default function PromoAtacadoConfig() {
  const [loja, setLoja]   = useState<Loja>("CGR");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [noAr, setNoAr]   = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy]   = useState<number | null>(null);
  const [msg, setMsg]     = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/promo-atacado?loja=${loja}`).then(r => r.json()).then(d => {
      setSlots(d.promo?.slots ?? []); setNoAr(d.noAr ?? []);
    }).catch(() => {});
  }, [loja]);
  useEffect(load, [load]);

  function patch(i: number, fn: (s: Slot) => void) {
    setSlots(prev => prev.map((s, j) => { if (j !== i) return s; const c = { ...s, textos: [...s.textos] }; fn(c); return c; }));
  }

  async function upload(i: number, file: File) {
    if (file.size > 1_000_000) { setMsg("❌ Imagem muito grande (máx ~1MB)."); return; }
    setBusy(i); setMsg("");
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file);
    });
    const r = await fetch("/api/admin/promo-atacado/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot: i, dataUrl, loja }) });
    if (r.ok) { patch(i, s => { s.upload = true; s.imagem = ""; }); setMsg(`✅ Arte do slot ${i + 1} enviada. Não esqueça de salvar.`); }
    else { const d = await r.json(); setMsg(`❌ ${d.error ?? "Erro no upload"}`); }
    setBusy(null);
  }

  async function save() {
    setSaving(true); setMsg("");
    const r = await fetch("/api/admin/promo-atacado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots, loja }) });
    const d = await r.json();
    if (r.ok) { setMsg("✅ Promoções do atacado salvas!"); load(); } else setMsg(`❌ ${d.error ?? "Erro ao salvar"}`);
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["CGR", "TEM"] as Loja[]).map(l => (
          <button key={l} onClick={() => setLoja(l)} style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
            border: `1px solid ${loja === l ? "#082F58" : "#e2e8f0"}`,
            background: loja === l ? "#082F58" : "#fff", color: loja === l ? "#fff" : "#64748b",
          }}>{LOJA_NOME[l]}</button>
        ))}
      </div>

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#1e40af", lineHeight: 1.6 }}>
        🏭 Promoção da semana do <strong>atacado de {LOJA_NOME[loja]}</strong>, lida pelo painel do vendedor no WhatsApp.
        Só entra no ar dentro do período de datas. Os <strong>3 textos são variações para o vendedor</strong> copiar —
        texto idêntico saindo dezenas de vezes derruba o número de WhatsApp. Nunca escreva nome, CNPJ ou histórico de cliente:
        quem personaliza é o vendedor.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {slots.map((s, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${noAr[i] ? "#16a34a" : "#e2e8f0"}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Slot {i + 1}</span>
              {noAr[i] && <span style={{ fontSize: 10, fontWeight: 700, background: "#dcfce7", color: "#15803d", borderRadius: 20, padding: "2px 10px" }}>NO AR</span>}
            </div>
            <div style={{ padding: 14, display: "grid", gridTemplateColumns: "180px 1fr", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(s.upload || s.imagem) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.upload ? `/api/painel/promo-img/${loja}/${i}?t=${Date.now()}` : s.imagem} alt=""
                       style={{ width: "100%", height: 110, objectFit: "contain", background: "#f8fafc", borderRadius: 8, border: "1px solid #f1f5f9" }} />
                )}
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                  {busy === i ? "Enviando..." : "📎 Enviar arte"}
                  <input type="file" accept="image/*" style={{ display: "none" }}
                         onChange={e => { const f = e.target.files?.[0]; if (f) upload(i, f); e.target.value = ""; }} />
                </label>
                <input value={s.imagem} placeholder="ou URL da arte" onChange={e => patch(i, x => { x.imagem = e.target.value; x.upload = false; })} style={inp} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={s.titulo} placeholder="Título da promoção" onChange={e => patch(i, x => { x.titulo = e.target.value; })} style={{ ...inp, fontWeight: 600 }} />
                <input value={s.descricao} placeholder="Contexto curto para o vendedor" onChange={e => patch(i, x => { x.descricao = e.target.value; })} style={inp} />
                <div style={{ display: "flex", gap: 8 }}>
                  <label style={{ flex: 1, fontSize: 11, color: "#64748b" }}>Início
                    <input type="date" value={s.inicio} onChange={e => patch(i, x => { x.inicio = e.target.value; })} style={inp} />
                  </label>
                  <label style={{ flex: 1, fontSize: 11, color: "#64748b" }}>Fim
                    <input type="date" value={s.fim} onChange={e => patch(i, x => { x.fim = e.target.value; })} style={inp} />
                  </label>
                </div>
                {s.textos.map((t, j) => (
                  <div key={j}>
                    <textarea value={t} rows={2} placeholder={`Variação ${j + 1} para o vendedor`}
                              onChange={e => patch(i, x => { x.textos[j] = e.target.value; })}
                              style={{ ...inp, resize: "vertical" }} />
                    <div style={{ fontSize: 10, color: t.length > LIMITE ? "#b91c1c" : "#94a3b8", textAlign: "right" }}>
                      {t.length}/{LIMITE}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button onClick={save} disabled={saving} style={{
          padding: "10px 20px", background: saving ? "#94a3b8" : "#082F58", color: "#fff",
          border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "inherit",
          cursor: saving ? "not-allowed" : "pointer",
        }}>{saving ? "Salvando..." : "Salvar promoções do atacado"}</button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith("✅") ? "#15803d" : "#b91c1c" }}>{msg}</span>}
      </div>
    </div>
  );
}
