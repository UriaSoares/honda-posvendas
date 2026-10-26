"use client";

import { useState, useEffect, useCallback } from "react";
import type { Loja } from "@/lib/auth/users";

// Mapa de Peças — ver docs/MAPA-PECAS.md.
//
// Três visões na mesma aba: a fila de oportunidades (o que fazer hoje), a ficha
// da peça (o que o balcão consulta) e o resumo (o que a gestão abre).

type Visao = "fila" | "ficha" | "resumo";

interface Oportunidade {
  tipo: string; loja: string; cod: string; desc: string; valor: number;
  acao: string; detalhe: string; local?: string; preco?: number; margem?: number;
}
interface Fila {
  oportunidades: Oportunidade[];
  porTipo: Record<string, { itens: number; valor: number }>;
  semanas: string[];
}
interface Resumo {
  estoque: { loja: string; itens: number; capital: number }[];
  capital: number;
  tabela: number;
  pecas: number;
  xyz: { curva: string; itens: number }[];
  tributacao: { nome: string; itens: number }[];
  serie: { dia: string; capital: number }[];
  semana: { loja: string; receita: number; lucro: number; margem: number }[];
  vendedores: { nome: string; receita: number; desconto: number; margem: number }[];
  meta: { estoque?: { em: string; itens: number; margemDias: number | null }; vendas?: { em: string; inicio: string; fim: string } } | null;
}
interface Ficha {
  cod: string; desc: string;
  estoque: { loja: string; saldo: number; custo: number; base: number; dias: number; ultSaida: string | null; local: string; xyz: string; tipo: string }[];
  vendas: { loja: string; mov: string; qtd: number; valor: number; lucro: number; margem: number; abc: string }[];
  clientes: { cliente: string; vendedor: string; data: string | null; qtd: number; valor: number }[];
}

const ROTULOS: Record<string, { nome: string; cor: string; icone: string }> = {
  "parada-com-demanda": { nome: "Parada com demanda", cor: "#1A7F4F", icone: "📦" },
  "margem-fora-da-faixa": { nome: "Margem fora da faixa", cor: "#BE242C", icone: "📉" },
  "dispersao-de-preco": { nome: "Preço desencontrado", cor: "#B4690E", icone: "⚖️" },
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
const dataBR = (iso: string | null) =>
  iso ? iso.split("-").reverse().join("/") : "—";

const TITULO: React.CSSProperties = {
  font: "800 italic 20px/1.1 'Saira', 'Mulish', system-ui, sans-serif",
  textTransform: "uppercase", color: "#1060B0", margin: "0 0 2px",
  borderBottom: "3px solid #FBB814", paddingBottom: 5,
};
const SUB: React.CSSProperties = { fontSize: 13, color: "#64748b", margin: "0 0 12px" };
const NUMERO: React.CSSProperties = {
  font: "800 italic 30px/1 'Saira', 'Mulish', system-ui, sans-serif",
  color: "#1060B0", margin: "6px 0 3px", wordBreak: "break-word",
};
const PE: React.CSSProperties = { fontSize: 12.5, color: "#64748b" };
const CARD: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14,
};
const ROTULO: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: ".08em",
  textTransform: "uppercase", color: "#64748b",
};
const TH: React.CSSProperties = {
  textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".04em",
  textTransform: "uppercase", color: "#64748b", padding: "7px 9px",
  borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  padding: "8px 9px", borderBottom: "1px solid #f1f5f9", fontSize: 13,
};

function Aviso({ texto }: { texto: string }) {
  return <p style={{ color: "#64748b", fontSize: 13, margin: "16px 0" }}>{texto}</p>;
}

function subTab(ativo: boolean): React.CSSProperties {
  return {
    padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
    borderRadius: 7, border: "1px solid " + (ativo ? "#082F58" : "#e2e8f0"),
    background: ativo ? "#082F58" : "#fff", color: ativo ? "#fff" : "#475569",
    fontFamily: "inherit",
  };
}

export default function PecasPanel({ store }: { store: Loja }) {
  const [visao, setVisao] = useState<Visao>("resumo");

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button style={subTab(visao === "resumo")} onClick={() => setVisao("resumo")}>
          📊 Como estamos
        </button>
        <button style={subTab(visao === "fila")} onClick={() => setVisao("fila")}>
          🎯 Oportunidades
        </button>
        <button style={subTab(visao === "ficha")} onClick={() => setVisao("ficha")}>
          🔎 Ficha da peça
        </button>
      </div>

      {/* `key` remonta ao trocar de loja: o estado nasce limpo e o efeito não
          precisa zerar nada de forma síncrona. */}
      {visao === "fila" && <PainelFila key={store} store={store} />}
      {visao === "ficha" && <PainelFicha />}
      {visao === "resumo" && <PainelResumo />}
    </div>
  );
}

// --------------------------------------------------------------------- a fila

function PainelFila({ store }: { store: Loja }) {
  const [dados, setDados] = useState<Fila | null>(null);
  const [erro, setErro] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/pecas?loja=${store}`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        if (d.error) setErro(d.error);
        else setDados(d);
      })
      .catch((e) => { if (vivo) setErro(String(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [store]);

  if (carregando) return <Aviso texto="Carregando oportunidades..." />;
  if (erro) return <Aviso texto={`Não deu para carregar: ${erro}`} />;
  if (!dados?.oportunidades.length)
    return <Aviso texto="Nenhuma oportunidade nesta loja. Se a coleta ainda não rodou, não há dado para analisar." />;

  const lista = tipo === "todos"
    ? dados.oportunidades
    : dados.oportunidades.filter((o) => o.tipo === tipo);
  const total = lista.reduce((s, o) => s + o.valor, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginBottom: 16 }}>
        {Object.entries(dados.porTipo).map(([t, v]) => {
          const r = ROTULOS[t] ?? { nome: t, cor: "#475569", icone: "•" };
          return (
            <button
              key={t}
              onClick={() => setTipo(tipo === t ? "todos" : t)}
              style={{
                ...CARD, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                borderLeft: `4px solid ${r.cor}`,
                outline: tipo === t ? `2px solid ${r.cor}` : "none",
              }}
            >
              <span style={ROTULO}>{r.icone} {r.nome}</span>
              <div style={{ fontSize: 21, fontWeight: 800, color: r.cor, marginTop: 4 }}>
                {brl(v.valor)}
              </div>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {v.itens} {v.itens === 1 ? "peça" : "peças"}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 10px" }}>
        {lista.length} {lista.length === 1 ? "oportunidade" : "oportunidades"} · {brl(total)} em jogo
        {tipo !== "todos" && " · clique no cartão de novo para ver todas"}
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        {lista.slice(0, 100).map((o, n) => {
          const r = ROTULOS[o.tipo] ?? { nome: o.tipo, cor: "#475569", icone: "•" };
          return (
            <div key={`${o.loja}-${o.cod}-${o.tipo}-${n}`} style={{ ...CARD, borderLeft: `4px solid ${r.cor}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: r.cor }}>{r.icone} {r.nome}</span>
                    <code style={{ fontSize: 12, color: "#334155", background: "#f1f5f9", padding: "1px 6px", borderRadius: 4 }}>
                      {o.cod}
                    </code>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{o.loja}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{o.desc}</div>
                  <div style={{ fontSize: 13, color: "#334155", marginTop: 3 }}>{o.acao}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {o.detalhe}
                    {o.local ? ` · ${o.local}` : ""}
                    {o.margem !== undefined ? ` · margem ${pct(o.margem)}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: r.cor }}>{brl(o.valor)}</div>
                  <span style={{ ...ROTULO, fontSize: 10 }}>em jogo</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {lista.length > 100 && (
        <Aviso texto={`Mostrando as 100 maiores de ${lista.length}.`} />
      )}
    </div>
  );
}

// -------------------------------------------------------------------- a ficha

function PainelFicha() {
  const [cod, setCod] = useState("");
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);

  const buscar = useCallback(async () => {
    if (!cod.trim()) return;
    setBuscando(true);
    setErro("");
    setFicha(null);
    try {
      const r = await fetch(`/api/pecas/ficha?cod=${encodeURIComponent(cod.trim())}`);
      const d = await r.json();
      if (d.error) setErro(d.error);
      else setFicha(d);
    } catch (e) {
      setErro(String(e));
    } finally {
      setBuscando(false);
    }
  }, [cod]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          id="pecas-ficha-codigo"
          value={cod}
          onChange={(e) => setCod(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder="Código da peça — ex.: 12391KRM840"
          style={{
            flex: "1 1 280px", padding: "9px 12px", fontSize: 14, borderRadius: 8,
            border: "1px solid #cbd5e1", fontFamily: "inherit",
          }}
        />
        <button
          onClick={buscar}
          disabled={buscando}
          style={{
            padding: "9px 18px", fontSize: 14, fontWeight: 600, borderRadius: 8,
            border: "none", background: "#082F58", color: "#fff",
            cursor: buscando ? "default" : "pointer", fontFamily: "inherit",
          }}
        >{buscando ? "Buscando..." : "Buscar"}</button>
      </div>

      {erro && <Aviso texto={erro} />}
      {!ficha && !erro && !buscando && (
        <Aviso texto="Digite o código para ver estoque nas duas lojas, giro e preço praticado." />
      )}

      {ficha && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={CARD}>
            <span style={ROTULO}>Peça</span>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{ficha.desc}</div>
            <code style={{ fontSize: 13, color: "#64748b" }}>{ficha.cod}</code>
          </div>

          <div style={CARD}>
            <span style={ROTULO}>Estoque parado</span>
            {ficha.estoque.length === 0 ? (
              <Aviso texto="Não aparece na lista de mercadoria parada — ou gira, ou está zerada." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                  <thead><tr>
                    <th style={TH}>Loja</th><th style={TH}>Saldo</th><th style={TH}>Custo</th>
                    <th style={TH}>Tabela</th><th style={TH}>Dias parado</th>
                    <th style={TH}>Última saída</th><th style={TH}>XYZ</th><th style={TH}>Local</th>
                  </tr></thead>
                  <tbody>
                    {ficha.estoque.map((e, n) => (
                      <tr key={n}>
                        <td style={{ ...TD, fontWeight: 700 }}>{e.loja}</td>
                        <td style={TD}>{e.saldo}</td>
                        <td style={TD}>{brl(e.custo)}</td>
                        <td style={TD}>{brl(e.base)}</td>
                        <td style={TD}>{e.dias}</td>
                        <td style={TD}>{dataBR(e.ultSaida)}</td>
                        <td style={TD}>{e.xyz}</td>
                        <td style={{ ...TD, fontSize: 12, color: "#64748b" }}>{e.local || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={CARD}>
            <span style={ROTULO}>Como vem saindo</span>
            {ficha.vendas.length === 0 ? (
              <Aviso texto="Sem venda registrada nas semanas coletadas." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                  <thead><tr>
                    <th style={TH}>Loja</th><th style={TH}>Movimento</th><th style={TH}>Qtd</th>
                    <th style={TH}>Valor</th><th style={TH}>Lucro</th><th style={TH}>Margem</th><th style={TH}>ABC</th>
                  </tr></thead>
                  <tbody>
                    {ficha.vendas.map((v, n) => (
                      <tr key={n}>
                        <td style={{ ...TD, fontWeight: 700 }}>{v.loja}</td>
                        <td style={{ ...TD, fontSize: 12 }}>{v.mov}</td>
                        <td style={TD}>{v.qtd}</td>
                        <td style={TD}>{brl(v.valor)}</td>
                        <td style={TD}>{brl(v.lucro)}</td>
                        <td style={{ ...TD, fontWeight: 700, color: v.margem < 0.22 ? "#BE242C" : "#1A7F4F" }}>
                          {pct(v.margem)}
                        </td>
                        <td style={TD}>{v.abc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {ficha.clientes.length > 0 && (
            <div style={CARD}>
              <span style={ROTULO}>Quem comprou</span>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                  <thead><tr>
                    <th style={TH}>Data</th><th style={TH}>Cliente</th>
                    <th style={TH}>Vendedor</th><th style={TH}>Qtd</th><th style={TH}>Valor</th>
                  </tr></thead>
                  <tbody>
                    {ficha.clientes.map((c, n) => (
                      <tr key={n}>
                        <td style={TD}>{dataBR(c.data)}</td>
                        <td style={TD}>{c.cliente}</td>
                        <td style={{ ...TD, fontSize: 12, color: "#64748b" }}>{c.vendedor}</td>
                        <td style={TD}>{c.qtd}</td>
                        <td style={TD}>{brl(c.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- o resumo

function Barra({ valor, maximo, cor, largura = 320 }: { valor: number; maximo: number; cor: string; largura?: number }) {
  const w = maximo > 0 ? Math.max((valor / maximo) * largura, valor > 0 ? 3 : 0) : 0;
  return (
    <svg viewBox={`0 0 ${largura} 20`} style={{ width: largura, maxWidth: "100%", height: 20 }} aria-hidden="true">
      <rect x="0" y="3" width={largura} height="14" rx="4" fill="#e8ecf2" />
      <rect x="0" y="3" width={w} height="14" rx="4" fill={cor} />
    </svg>
  );
}

const COR_LOJA: Record<string, string> = { CGR: "#1060B0", TEM: "#C2410C" };

function PainelResumo() {
  const [dados, setDados] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch("/api/pecas?visao=resumo")
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        if (d.error) setErro(d.error);
        else setDados(d);
      })
      .catch((e) => { if (vivo) setErro(String(e)); });
    return () => { vivo = false; };
  }, []);

  if (erro) return <Aviso texto={`Não deu para carregar: ${erro}`} />;
  if (!dados) return <Aviso texto="Carregando..." />;

  const receitaSemana = dados.semana.reduce((s, x) => s + x.receita, 0);
  const lucroSemana = dados.semana.reduce((s, x) => s + x.lucro, 0);
  const margemSemana = receitaSemana ? lucroSemana / receitaSemana : 0;

  const serie = dados.serie;
  const primeiro = serie[0]?.capital ?? 0;
  const ultimo = serie.at(-1)?.capital ?? 0;
  const variacao = serie.length > 1 && primeiro ? (ultimo - primeiro) / primeiro : null;

  const maxCapital = Math.max(...dados.estoque.map((e) => e.capital), 1);
  const maxXyz = Math.max(...dados.xyz.map((x) => x.itens), 1);
  const maxTrib = Math.max(...dados.tributacao.map((t) => t.itens), 1);
  const maxVend = Math.max(...dados.vendedores.map((v) => v.receita), 1);
  const multiplo = dados.capital ? dados.tabela / dados.capital : 0;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Como estamos */}
      <section>
        <h3 style={TITULO}>Como estamos</h3>
        <p style={SUB}>Última semana coletada · todas as saídas de peça</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
          <div style={{ ...CARD, borderLeft: "5px solid #1060B0" }}>
            <span style={ROTULO}>Margem da semana</span>
            <div style={NUMERO}>{pct(margemSemana)}</div>
            <span style={PE}>{brl(lucroSemana)} de lucro</span>
          </div>
          <div style={CARD}>
            <span style={ROTULO}>Receita da semana</span>
            <div style={{ ...NUMERO, color: "#0F1115" }}>{brl(receitaSemana)}</div>
            <span style={PE}>
              {dados.semana.map((s) => `${s.loja} ${brl(s.receita)}`).join(" · ") || "—"}
            </span>
          </div>
          <div style={CARD}>
            <span style={ROTULO}>Capital parado</span>
            <div style={{ ...NUMERO, color: "#0F1115" }}>{brl(dados.capital)}</div>
            <span style={PE}>
              {dados.estoque.reduce((s, e) => s + e.itens, 0).toLocaleString("pt-BR")} códigos ·{" "}
              {dados.pecas.toLocaleString("pt-BR")} peças
            </span>
          </div>
          <div style={CARD}>
            <span style={ROTULO}>Variação do capital</span>
            {variacao === null ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#5A6271", marginTop: 6 }}>
                  Primeira medição
                </div>
                <span style={PE}>A comparação aparece a partir da segunda foto.</span>
              </>
            ) : (
              <>
                <div style={{ ...NUMERO, color: variacao > 0 ? "#BE242C" : "#1A7F4F" }}>
                  {variacao > 0 ? "▲" : "▼"} {pct(Math.abs(variacao))}
                </div>
                <span style={PE}>em {serie.length} dias de coleta</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Onde o capital está preso */}
      <section>
        <h3 style={TITULO}>Onde o capital está preso</h3>
        <p style={SUB}>
          {brl(dados.capital)} de custo valem {brl(dados.tabela)} a preço de tabela
          {multiplo > 0 && ` — ${multiplo.toFixed(1).replace(".", ",")} vezes`}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(330px,1fr))", gap: 12 }}>
          <div style={CARD}>
            <span style={ROTULO}>Por loja</span>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {dados.estoque.map((e) => (
                <div key={e.loja}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
                    <b>{e.loja}</b>
                    <span style={{ fontWeight: 700 }}>{brl(e.capital)}</span>
                  </div>
                  <Barra valor={e.capital} maximo={maxCapital} cor={COR_LOJA[e.loja] ?? "#1060B0"} />
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>
                    {e.itens.toLocaleString("pt-BR")} códigos
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={CARD}>
            <span style={ROTULO}>Previsibilidade de demanda</span>
            <p style={{ ...PE, margin: "2px 0 10px" }}>Curva XYZ dos códigos parados.</p>
            <div style={{ display: "grid", gap: 8 }}>
              {dados.xyz.map((x) => (
                <div key={x.curva}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <b>{x.curva}</b>
                    <span>{x.itens.toLocaleString("pt-BR")}</span>
                  </div>
                  <Barra valor={x.itens} maximo={maxXyz} cor="#1060B0" />
                </div>
              ))}
            </div>
          </div>

          <div style={CARD}>
            <span style={ROTULO}>Regime tributário</span>
            <p style={{ ...PE, margin: "2px 0 10px" }}>
              Pesa na decisão de transferir entre lojas: na ST o imposto já foi pago.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {dados.tributacao.map((t) => (
                <div key={t.nome}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <b>{t.nome}</b>
                    <span>{t.itens.toLocaleString("pt-BR")}</span>
                  </div>
                  <Barra valor={t.itens} maximo={maxTrib} cor="#1060B0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Equipe */}
      {dados.vendedores.length > 0 && (
        <section>
          <h3 style={TITULO}>A equipe</h3>
          <p style={SUB}>Última semana coletada · receita, desconto e margem por vendedor</p>
          <div style={{ overflowX: "auto", ...CARD }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={TH}>Vendedor</th><th style={TH}>Receita</th>
                <th style={TH} /><th style={TH}>Desconto</th><th style={TH}>Margem</th>
              </tr></thead>
              <tbody>
                {dados.vendedores.map((v) => (
                  <tr key={v.nome}>
                    <td style={{ ...TD, fontWeight: 700 }}>{v.nome}</td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>{brl(v.receita)}</td>
                    <td style={{ ...TD, width: "40%" }}>
                      <Barra valor={v.receita} maximo={maxVend} cor="#1060B0" largura={260} />
                    </td>
                    <td style={TD}>{pct(v.desconto)}</td>
                    <td style={{ ...TD, fontWeight: 700, color: v.margem < 0.25 ? "#BE242C" : "#1A7F4F" }}>
                      {pct(v.margem)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dados.meta && (
        <div style={{ ...CARD, background: "#f8fafc" }}>
          <span style={ROTULO}>Coleta</span>
          <div style={{ fontSize: 12.5, color: "#475569", marginTop: 6, lineHeight: 1.7 }}>
            {dados.meta.estoque && (
              <div>
                Estoque: {new Date(dados.meta.estoque.em).toLocaleString("pt-BR")} ·{" "}
                {dados.meta.estoque.itens.toLocaleString("pt-BR")} códigos
                {dados.meta.estoque.margemDias !== null && (
                  <> · margem da janela: {dados.meta.estoque.margemDias} dias</>
                )}
              </div>
            )}
            {dados.meta.vendas && (
              <div>
                Vendas: {new Date(dados.meta.vendas.em).toLocaleString("pt-BR")} ·{" "}
                {dataBR(dados.meta.vendas.inicio)} a {dataBR(dados.meta.vendas.fim)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
