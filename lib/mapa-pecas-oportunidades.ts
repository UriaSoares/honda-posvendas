import {
  lerEstoque, lerVendas, lerCesta, lerSemanas, lerResumoEstoque, lerMeta,
  type ItemEstoque, type VendaCodigo, type ItemCliente, type ResumoEstoque,
} from "@/lib/mapa-pecas";
import type { Loja } from "@/lib/auth/users";

// Detectores do Mapa de Peças — ver docs/MAPA-PECAS.md.
//
// Toda regra devolve a mesma forma: peça, loja, quanto está em jogo e o que
// fazer. É essa uniformidade que deixa a fila ser uma fila, e não três
// relatórios diferentes colados na mesma tela.
//
// Esta é a primeira onda: só o que o dado de hoje já responde. Obsolescência
// prevista, ruptura prevista e cesta de compra precisam de meses de histórico
// e entram quando a coleta tiver acumulado.

export type TipoOportunidade = "parada-com-demanda" | "margem-fora-da-faixa" | "dispersao-de-preco";

export interface Oportunidade {
  tipo: TipoOportunidade;
  loja: string;
  cod: string;
  desc: string;
  valor: number;        // o que está em jogo, em reais
  acao: string;
  detalhe: string;
  local?: string;
  preco?: number;
  margem?: number;
}

export const ROTULOS: Record<TipoOportunidade, { nome: string; cor: string; icone: string }> = {
  "parada-com-demanda": { nome: "Parada com demanda", cor: "#1A7F4F", icone: "📦" },
  "margem-fora-da-faixa": { nome: "Margem fora da faixa", cor: "#BE242C", icone: "📉" },
  "dispersao-de-preco": { nome: "Preço desencontrado", cor: "#B4690E", icone: "⚖️" },
};

// ------------------------------------------------------------------ parâmetros

/** Desconto praticado na peça parada. */
const DESCONTO_PARADA = 0.20;
/** Janela da última saída: fora disso não é "tem demanda", é encalhe. */
const DIAS_DEMANDA = 180;
/** Abaixo dessa margem a peça parada não recompõe nada. */
const MARGEM_MIN_PARADA = 0.40;
/** Faixa de preço que o balcão de atacado vende sem negociação longa. */
const PRECO_PARADA = { min: 30, max: 900 };

/**
 * Piso de margem por tipo de movimento. Atacado trabalha com margem menor que
 * balcão por natureza, então comparar tudo contra um número só geraria alarme
 * falso no atacado e deixaria o varejo passar batido.
 */
const PISO_MARGEM: { teste: (mov: string) => boolean; piso: number; rotulo: string }[] = [
  { teste: (m) => m.includes("ATACADO"), piso: 0.22, rotulo: "atacado" },
  { teste: (m) => m.includes("O.S."), piso: 0.28, rotulo: "oficina" },
  { teste: () => true, piso: 0.30, rotulo: "balcão" },
];

/** Abaixo disso a venda é pequena demais para merecer uma oportunidade. */
const VALOR_MIN_MARGEM = 150;
/** Quanto o preço unitário pode variar antes de virar desencontro. */
const RAZAO_DISPERSAO = 1.3;
const LINHAS_MIN_DISPERSAO = 3;

const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const dias = (iso: string | null, hoje: number) =>
  iso ? Math.round((hoje - Date.parse(iso)) / 86400000) : null;

// ------------------------------------------------------------------ detectores

export function paradaComDemanda(estoque: ItemEstoque[], hoje = Date.now()): Oportunidade[] {
  const out: Oportunidade[] = [];
  for (const i of estoque) {
    if (i.saldo < 1 || i.custo <= 0) continue;
    if (i.base < PRECO_PARADA.min || i.base > PRECO_PARADA.max) continue;
    const d = dias(i.ultSaida, hoje);
    if (d === null || d > DIAS_DEMANDA) continue;
    const preco = i.base * (1 - DESCONTO_PARADA);
    const margem = (preco - i.custo) / preco;
    if (margem < MARGEM_MIN_PARADA) continue;
    out.push({
      tipo: "parada-com-demanda",
      loja: i.emp,
      cod: i.cod,
      desc: i.desc,
      valor: Math.round((preco - i.custo) * i.saldo * 100) / 100,
      acao: `Oferecer a ${brl(preco)} — ${pct(DESCONTO_PARADA)} de desconto`,
      detalhe: `${i.saldo} em estoque, saiu há ${d} ${d === 1 ? "dia" : "dias"}`,
      local: i.loc,
      preco: Math.round(preco * 100) / 100,
      margem: Math.round(margem * 1000) / 1000,
    });
  }
  return out.sort((a, b) => b.valor - a.valor);
}

export function margemForaDaFaixa(vendas: VendaCodigo[]): Oportunidade[] {
  const out: Oportunidade[] = [];
  for (const v of vendas) {
    if (v.valor < VALOR_MIN_MARGEM || v.qtd <= 0) continue;
    const regra = PISO_MARGEM.find((r) => r.teste(v.mov.toUpperCase()))!;
    const margem = v.valor ? v.lucro / v.valor : 0;
    if (margem >= regra.piso) continue;
    // Quanto de lucro a venda teria deixado se estivesse no piso da faixa.
    const perda = v.valor * (regra.piso - margem);
    out.push({
      tipo: "margem-fora-da-faixa",
      loja: v.emp,
      cod: v.cod,
      desc: v.desc,
      valor: Math.round(perda * 100) / 100,
      acao: `Rever o preço: faixa de ${regra.rotulo} começa em ${pct(regra.piso)}`,
      detalhe: `${v.qtd.toFixed(0)} un em ${brl(v.valor)} a ${pct(margem)} de margem`,
      margem: Math.round(margem * 1000) / 1000,
    });
  }
  return out.sort((a, b) => b.valor - a.valor);
}

export function dispersaoDePreco(cesta: ItemCliente[]): Oportunidade[] {
  const porCod = new Map<string, { emp: string; desc: string; precos: number[]; clientes: Set<string> }>();
  for (const l of cesta) {
    if (l.qtd <= 0 || l.valor <= 0) continue;
    const chave = `${l.emp}|${l.cod}`;
    const reg = porCod.get(chave) ?? { emp: l.emp, desc: "", precos: [], clientes: new Set<string>() };
    reg.precos.push(l.valor / l.qtd);
    reg.clientes.add(l.cliente);
    porCod.set(chave, reg);
  }

  const out: Oportunidade[] = [];
  for (const [chave, reg] of porCod) {
    if (reg.precos.length < LINHAS_MIN_DISPERSAO) continue;
    const min = Math.min(...reg.precos);
    const max = Math.max(...reg.precos);
    if (min <= 0 || max / min < RAZAO_DISPERSAO) continue;
    const cod = chave.split("|")[1];
    // O que se deixou de ganhar vendendo abaixo do melhor preço praticado.
    const perda = reg.precos.reduce((s, p) => s + (max - p), 0);
    out.push({
      tipo: "dispersao-de-preco",
      loja: reg.emp,
      cod,
      desc: reg.desc,
      valor: Math.round(perda * 100) / 100,
      acao: `Alinhar o preço: a mesma peça saiu de ${brl(min)} a ${brl(max)}`,
      detalhe: `${reg.precos.length} vendas para ${reg.clientes.size} ${reg.clientes.size === 1 ? "cliente" : "clientes"}`,
    });
  }
  return out.sort((a, b) => b.valor - a.valor);
}

// --------------------------------------------------------------------- a fila

export interface Fila {
  oportunidades: Oportunidade[];
  porTipo: Record<string, { itens: number; valor: number }>;
  semanas: string[];
}

export async function montarFila(loja?: Loja): Promise<Fila> {
  const semanas = await lerSemanas();
  const recentes = semanas.slice(-4);
  const [estoque, vendas, cesta] = await Promise.all([
    lerEstoque(),
    lerVendas(recentes),
    lerCesta(recentes),
  ]);

  const filtro = <T extends { emp: string }>(l: T[]) => (loja ? l.filter((x) => x.emp === loja) : l);

  // A descrição não vem no relatório de item por cliente; o de vendas tem.
  const descPorCod = new Map<string, string>(vendas.map((v) => [v.cod, v.desc] as const));
  const disp = dispersaoDePreco(filtro(cesta)).map((o) => ({
    ...o, desc: o.desc || descPorCod.get(o.cod) || o.cod,
  }));

  const oportunidades = [
    ...paradaComDemanda(filtro(estoque)),
    ...margemForaDaFaixa(filtro(vendas)),
    ...disp,
  ].sort((a, b) => b.valor - a.valor);

  const porTipo: Fila["porTipo"] = {};
  for (const o of oportunidades) {
    const t = (porTipo[o.tipo] ??= { itens: 0, valor: 0 });
    t.itens += 1;
    t.valor = Math.round((t.valor + o.valor) * 100) / 100;
  }
  return { oportunidades, porTipo, semanas: recentes };
}

// ------------------------------------------------------------------- o resumo

export interface Resumo {
  estoque: { loja: string; itens: number; capital: number }[];
  serie: { dia: string; capital: number }[];
  semana: { loja: string; receita: number; lucro: number; margem: number }[];
  meta: Awaited<ReturnType<typeof lerMeta>>;
}

export async function montarResumo(): Promise<Resumo> {
  const semanas = await lerSemanas();
  const [serieBruta, vendas, meta] = await Promise.all([
    lerResumoEstoque(),
    lerVendas(semanas.slice(-1)),
    lerMeta(),
  ]);

  const porLojaUltimo: ResumoEstoque["porLoja"] = serieBruta.at(-1)?.porLoja ?? {};
  const estoque = Object.entries(porLojaUltimo).map(([loja, v]) => ({
    loja, itens: v.itens, capital: v.capital,
  }));

  const porLoja = new Map<string, { receita: number; lucro: number }>();
  for (const v of vendas) {
    const r = porLoja.get(v.emp) ?? { receita: 0, lucro: 0 };
    r.receita += v.valor;
    r.lucro += v.lucro;
    porLoja.set(v.emp, r);
  }

  return {
    estoque,
    serie: serieBruta.slice(-30).map((r) => ({ dia: r.dia, capital: r.capital })),
    semana: [...porLoja].map(([loja, r]) => ({
      loja,
      receita: Math.round(r.receita * 100) / 100,
      lucro: Math.round(r.lucro * 100) / 100,
      margem: r.receita ? Math.round((r.lucro / r.receita) * 1000) / 1000 : 0,
    })),
    meta,
  };
}

// ------------------------------------------------------------- ficha da peça

export interface Ficha {
  cod: string;
  desc: string;
  estoque: { loja: string; saldo: number; custo: number; base: number; dias: number; ultSaida: string | null; local: string; xyz: string; tipo: string }[];
  vendas: { loja: string; mov: string; qtd: number; valor: number; lucro: number; margem: number; abc: string }[];
  clientes: { cliente: string; vendedor: string; data: string | null; qtd: number; valor: number }[];
}

export async function montarFicha(codigo: string): Promise<Ficha | null> {
  const cod = codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cod) return null;

  const semanas = await lerSemanas();
  const [estoque, vendas, cesta] = await Promise.all([
    lerEstoque(),
    lerVendas(semanas),
    lerCesta(semanas),
  ]);

  const igual = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "") === cod;
  const noEstoque = estoque.filter((i) => igual(i.cod));
  const naVenda = vendas.filter((v) => igual(v.cod));
  if (!noEstoque.length && !naVenda.length) return null;

  return {
    cod,
    desc: naVenda[0]?.desc || noEstoque[0]?.desc || cod,
    estoque: noEstoque.map((i) => ({
      loja: i.emp, saldo: i.saldo, custo: i.custo, base: i.base, dias: i.dias,
      ultSaida: i.ultSaida, local: i.loc, xyz: i.xyz, tipo: i.tipo,
    })),
    vendas: naVenda.map((v) => ({
      loja: v.emp, mov: v.mov, qtd: v.qtd, valor: v.valor, lucro: v.lucro,
      margem: v.valor ? Math.round((v.lucro / v.valor) * 1000) / 1000 : 0,
      abc: v.abc,
    })),
    clientes: cesta.filter((l) => igual(l.cod))
      .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))
      .slice(0, 20)
      .map((l) => ({ cliente: l.cliente, vendedor: l.vendedor, data: l.data, qtd: l.qtd, valor: l.valor })),
  };
}
