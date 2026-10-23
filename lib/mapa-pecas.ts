import { redis } from "@/lib/redis";
import { dateCG, type RawRow } from "@/lib/microwork";
import {
  REL_VENDAS_CODIGO, REL_ITEM_CLIENTE, REL_VENDA_CLIENTE,
  TM_ITEM_CLIENTE, TM_VENDA_CLIENTE,
  filtrosVendasCodigo, filtrosCliente,
} from "@/lib/mapa-pecas-filtros";

// Coleta do Mapa de Peças — ver docs/MAPA-PECAS.md.
//
// Quatro relatórios do Microwork alimentam os detectores de oportunidade. Aqui
// só se coleta e normaliza; quem decide o que é oportunidade vem depois.
//
// O estoque é uma FOTO: vale a de hoje, e a de ontem não interessa linha a
// linha. Já o faturamento é HISTÓRICO: cada semana fica guardada, porque é dela
// que saem velocidade de giro, obsolescência prevista e cesta de compra — e
// esses só funcionam com meses acumulados. Por isso o estoque é sobrescrito e
// as vendas são acumuladas por semana.

const NS = "mapa:pecas";
const SHARDS = 10;
const estoqueKey = (n: number) => `${NS}:estoque:${n}`;
const vendaKey = (semana: string) => `${NS}:venda:${semana}`;
const cestaKey = (semana: string) => `${NS}:cesta:${semana}`;
const clienteKey = (semana: string) => `${NS}:cliente:${semana}`;
const RESUMO_KEY = `${NS}:estoque:resumo`;
const SEMANAS_KEY = `${NS}:semanas`;
const META_KEY = `${NS}:meta`;

/** Semanas de faturamento mantidas: um ano é o bastante para sazonalidade. */
export const MAX_SEMANAS = 53;

// ------------------------------------------------------------------ utilidades

const s = (v: unknown) => (v == null ? "" : String(v)).trim();

/**
 * O ERP mistura formatos no mesmo relatório: `customedio` volta number e
 * `saldodisponivel` volta "1,0000". Normaliza os dois.
 */
export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = s(v);
  if (!t) return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : 0;
}

/** "2026-10-23T00:00:00" → "2026-10-23"; vazio → null. */
export function data(v: unknown): string | null {
  const t = s(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/** Semana ISO ("2026-W43"), que é como o histórico de vendas é fatiado. */
export function semanaISO(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - dia + 3); // quinta da mesma semana
  const ano = d.getUTCFullYear();
  const primeira = new Date(Date.UTC(ano, 0, 4));
  const offset = (primeira.getUTCDay() + 6) % 7;
  const n = 1 + Math.round((d.getTime() - primeira.getTime()) / 86400000 / 7 - (3 - offset) / 7);
  return `${ano}-W${String(n).padStart(2, "0")}`;
}

const shardDe = (cod: string) => {
  let h = 0;
  for (let i = 0; i < cod.length; i++) h = (h * 31 + cod.charCodeAt(i)) >>> 0;
  return h % SHARDS;
};

// --------------------------------------------------------------------- estoque

export interface ItemEstoque {
  cod: string;
  emp: string;        // CGR / TEM
  desc: string;
  tipo: string;       // coeficiente: HONDA MOTOS, ACESSÓRIOS…
  xyz: string;
  saldo: number;
  custo: number;
  base: number;       // preço de tabela sugerido
  dias: number;       // dias parado
  ultSaida: string | null;
  ultEntrada: string | null;
  obsDesde: string | null;
  loc: string;
  trib: string;
  monofasico: boolean;
  ncm: string;
}

export function normalizarEstoque(linhas: RawRow[]): ItemEstoque[] {
  const out: ItemEstoque[] = [];
  for (const l of linhas) {
    const cod = s(l.codigomercadoria);
    if (!cod) continue;
    out.push({
      cod,
      emp: s(l.empresareduzida),
      desc: s(l.descricaomercadoria),
      tipo: s(l.coeficiente),
      xyz: s(l.curvaxyz),
      saldo: num(l.saldodisponivel),
      custo: num(l.customedio),
      base: num(l.valorbasevenda),
      dias: Math.round(num(l.diasparado)),
      ultSaida: data(l.datamovimentacaoultimasaida),
      ultEntrada: data(l.datamovimentacaoultimaentrada),
      obsDesde: data(l.obsoletodesde),
      loc: s(l.localizacoes),
      trib: s(l.tributacao),
      monofasico: s(l.produtomonofasico) === "t",
      ncm: s(l.codigoncm),
    });
  }
  return out;
}

export interface ResumoEstoque {
  dia: string;
  itens: number;
  pecas: number;
  capital: number;
  tabela: number;
  porLoja: Record<string, { itens: number; capital: number }>;
}

/** Foto diária enxuta — é ela que permite ver a curva de encalhe no tempo. */
export function resumirEstoque(itens: ItemEstoque[], dia: string): ResumoEstoque {
  const porLoja: ResumoEstoque["porLoja"] = {};
  let pecas = 0, capital = 0, tabela = 0;
  for (const i of itens) {
    const cap = i.saldo * i.custo;
    pecas += i.saldo;
    capital += cap;
    tabela += i.saldo * i.base;
    const loja = (porLoja[i.emp] ??= { itens: 0, capital: 0 });
    loja.itens += 1;
    loja.capital = Math.round((loja.capital + cap) * 100) / 100;
  }
  return {
    dia,
    itens: itens.length,
    pecas: Math.round(pecas),
    capital: Math.round(capital * 100) / 100,
    tabela: Math.round(tabela * 100) / 100,
    porLoja,
  };
}

export async function gravarEstoque(itens: ItemEstoque[], dia: string): Promise<ResumoEstoque> {
  const shards: ItemEstoque[][] = Array.from({ length: SHARDS }, () => []);
  for (const i of itens) shards[shardDe(i.cod + i.emp)].push(i);
  await Promise.all(shards.map((lista, n) => redis.set(estoqueKey(n), lista)));

  const resumo = resumirEstoque(itens, dia);
  const hist = (await redis.get<ResumoEstoque[]>(RESUMO_KEY)) ?? [];
  const sem = hist.filter((r) => r.dia !== dia);
  sem.push(resumo);
  sem.sort((a, b) => a.dia.localeCompare(b.dia));
  await redis.set(RESUMO_KEY, sem.slice(-400));
  return resumo;
}

export async function lerEstoque(): Promise<ItemEstoque[]> {
  const shards = await Promise.all(
    Array.from({ length: SHARDS }, (_, n) => redis.get<ItemEstoque[]>(estoqueKey(n)))
  );
  return shards.flatMap((lista) => lista ?? []);
}

export async function lerResumoEstoque(): Promise<ResumoEstoque[]> {
  return (await redis.get<ResumoEstoque[]>(RESUMO_KEY)) ?? [];
}

// --------------------------------------------------------------- venda por código

export interface VendaCodigo {
  emp: string;
  cod: string;
  desc: string;
  mov: string;        // VENDA PEÇAS - ATACADO, VENDA POR O.S. - OFICINA…
  abc: string;
  xyz: string;
  qtd: number;
  valor: number;
  cmv: number;
  lucro: number;
  descPct: number;    // ponderado pelo valor
}

/**
 * Agrega por loja + código + tipo de movimento. O tipo entra na chave porque
 * atacado, balcão e oficina têm margens diferentes e misturá-los esconde
 * justamente o que o detector de margem procura.
 */
export function normalizarVendas(linhas: RawRow[]): VendaCodigo[] {
  const mapa = new Map<string, VendaCodigo & { _descPeso: number }>();
  for (const l of linhas) {
    const cod = s(l.codigomercadoria);
    if (!cod) continue;
    const emp = s(l.empresareduzida);
    const mov = s(l.tipomovimento);
    const chave = `${emp}|${cod}|${mov}`;
    const valor = num(l.valortotal);
    const atual = mapa.get(chave);
    if (atual) {
      atual.qtd += num(l.quantidade);
      atual.valor += valor;
      atual.cmv += num(l.cmvcontabiltotal);
      atual.lucro += num(l.lucrobrutomoeda);
      atual._descPeso += num(l.descontopercentual) * valor;
    } else {
      mapa.set(chave, {
        emp, cod, mov,
        desc: s(l.descricaomercadoria),
        abc: s(l.curvaabc),
        xyz: s(l.curvaxyz),
        qtd: num(l.quantidade),
        valor,
        cmv: num(l.cmvcontabiltotal),
        lucro: num(l.lucrobrutomoeda),
        descPct: 0,
        _descPeso: num(l.descontopercentual) * valor,
      });
    }
  }
  return [...mapa.values()].map(({ _descPeso, ...v }) => ({
    ...v,
    qtd: Math.round(v.qtd * 1000) / 1000,
    valor: Math.round(v.valor * 100) / 100,
    cmv: Math.round(v.cmv * 100) / 100,
    lucro: Math.round(v.lucro * 100) / 100,
    descPct: v.valor ? Math.round((_descPeso / v.valor) * 100) / 100 : 0,
  }));
}

// ------------------------------------------------------- item por cliente (cesta)

export interface ItemCliente {
  emp: string;
  vendedor: string;
  cliente: string;
  municipio: string;
  cod: string;
  data: string | null;
  qtd: number;
  valor: number;
  desconto: number;
  lucro: number;
}

export function normalizarCesta(linhas: RawRow[]): ItemCliente[] {
  const out: ItemCliente[] = [];
  for (const l of linhas) {
    const cod = s(l.codigomercadoria);
    if (!cod) continue;
    out.push({
      emp: s(l.empresa),
      vendedor: s(l.pessoavendedor),
      cliente: s(l.nomeourazaosocial),
      municipio: s(l.municipio),
      cod,
      data: data(l.dataemissaodoctofiscal),
      qtd: num(l.quantidade),
      valor: num(l.valortotalrequisicaoitem),
      desconto: num(l.valortotaldesconto),
      lucro: num(l.valorlucrobruto),
    });
  }
  return out;
}

// ---------------------------------------------------------- venda por cliente

export interface VendaCliente {
  emp: string;
  documento: string;
  cliente: string;
  vendedor: string;
  municipio: string;
  nota: string;
  recebimento: string;   // ADIANTAMENTO, BOLETO - ATÉ 5X… base do risco de crédito
  qtd: number;
  valor: number;
  lucro: number;
}

export function normalizarClientes(linhas: RawRow[]): VendaCliente[] {
  const out: VendaCliente[] = [];
  for (const l of linhas) {
    const doc = s(l.cpfoucnpj).replace(/\D/g, "");
    if (!doc) continue;
    out.push({
      emp: s(l.empresa),
      documento: doc,
      cliente: s(l.nomeourazaosocial),
      vendedor: s(l.pessoavendedor),
      municipio: s(l.municipio),
      nota: s(l.doctofiscal),
      recebimento: s(l.financeiroformarecebimento),
      qtd: num(l.quantidadereq),
      valor: num(l.valortotalrequisicaoitem),
      lucro: num(l.valorlucrobruto),
    });
  }
  return out;
}

// ------------------------------------------------------------------ histórico

/**
 * O cron roda com janela de 7 dias para apanhar nota lançada com atraso, então
 * a semana corrente e a anterior são reescritas a cada dia. É de propósito: o
 * dado do ERP muda depois do fato.
 */
export async function gravarSemanas<T extends { data?: string | null }>(
  chave: (semana: string) => string,
  registros: T[],
  semanaDe: (r: T) => string | null,
): Promise<string[]> {
  const porSemana = new Map<string, T[]>();
  for (const r of registros) {
    const sem = semanaDe(r);
    if (!sem) continue;
    (porSemana.get(sem) ?? porSemana.set(sem, []).get(sem)!).push(r);
  }
  await Promise.all([...porSemana].map(([sem, lista]) => redis.set(chave(sem), lista)));
  return [...porSemana.keys()];
}

export async function registrarSemanas(novas: string[]): Promise<string[]> {
  const atuais = (await redis.get<string[]>(SEMANAS_KEY)) ?? [];
  const todas = [...new Set([...atuais, ...novas])].sort().slice(-MAX_SEMANAS);
  await redis.set(SEMANAS_KEY, todas);
  return todas;
}

export async function lerSemanas(): Promise<string[]> {
  return (await redis.get<string[]>(SEMANAS_KEY)) ?? [];
}

export async function lerVendas(semanas: string[]): Promise<VendaCodigo[]> {
  const listas = await Promise.all(semanas.map((s) => redis.get<VendaCodigo[]>(vendaKey(s))));
  return listas.flatMap((l) => l ?? []);
}

export async function lerCesta(semanas: string[]): Promise<ItemCliente[]> {
  const listas = await Promise.all(semanas.map((s) => redis.get<ItemCliente[]>(cestaKey(s))));
  return listas.flatMap((l) => l ?? []);
}

export async function lerClientes(semanas: string[]): Promise<VendaCliente[]> {
  const listas = await Promise.all(semanas.map((s) => redis.get<VendaCliente[]>(clienteKey(s))));
  return listas.flatMap((l) => l ?? []);
}

// ------------------------------------------------------------------- metadados

export interface MetaMapa {
  estoque?: { em: string; itens: number; capital: number };
  vendas?: { em: string; inicio: string; fim: string; codigos: number; cesta: number; clientes: number };
  erro?: string;
}

export async function lerMeta(): Promise<MetaMapa | null> {
  return redis.get<MetaMapa>(META_KEY);
}

async function fundirMeta(parcial: MetaMapa): Promise<void> {
  const atual = (await lerMeta()) ?? {};
  await redis.set(META_KEY, { ...atual, ...parcial });
}

// -------------------------------------------------------------------- coletas

const EMPRESAS_PECAS = [2, 13, 4, 8, 9];

/**
 * `postRelatorio` manda a lista de 11 empresas que o Mapa da Qualidade usa.
 * Peças só precisa das cinco de CGR e TEM, então a chamada é montada aqui.
 */
async function relatorioPecas(body: {
  idrelatorioconfiguracao: number;
  idrelatorioconsulta: number;
  idrelatorioconfiguracaoleiaute: number;
  idrelatoriousuarioleiaute: number;
  filtros: string;
}): Promise<RawRow[]> {
  const res = await fetch("https://microworkcloud.com.br/api/integracao/terceiro", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: "microworkcloud.com.br",
      Authorization: `Bearer ${process.env.MICROWORK_TOKEN ?? ""}`,
    },
    body: JSON.stringify({ ...body, ididioma: 1, listaempresas: EMPRESAS_PECAS }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Microwork ${body.idrelatoriousuarioleiaute}: HTTP ${res.status}`);
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as RawRow[]) : [];
}

export async function coletarEstoque(): Promise<ResumoEstoque> {
  const linhas = await relatorioPecas({
    idrelatorioconfiguracao: 148,
    idrelatorioconsulta: 59,
    idrelatorioconfiguracaoleiaute: 148,
    idrelatoriousuarioleiaute: 963,
    filtros: [
      "CurvaXYZ=null",
      `ObsoletoDesde=${dateCG(-365)}`,
      "ComSaldo=True",
      "TipoMercadoria=null",
      "Marca=null",
      "SomenteMercadoriaOriginal=False",
      "SomenteComSaldoContabil=False",
    ].join(";"),
  });
  const itens = normalizarEstoque(linhas);
  const resumo = await gravarEstoque(itens, dateCG());
  await fundirMeta({ estoque: { em: new Date().toISOString(), itens: itens.length, capital: resumo.capital } });
  return resumo;
}

export async function coletarVendas(inicio: string, fim: string) {
  const [porCodigo, porItemCliente, porCliente] = await Promise.all([
    relatorioPecas({ ...REL_VENDAS_CODIGO, filtros: filtrosVendasCodigo(inicio, fim) }),
    relatorioPecas({ ...REL_ITEM_CLIENTE, filtros: filtrosCliente(inicio, fim, "2", TM_ITEM_CLIENTE) }),
    relatorioPecas({ ...REL_VENDA_CLIENTE, filtros: filtrosCliente(inicio, fim, "null", TM_VENDA_CLIENTE) }),
  ]);

  const vendas = normalizarVendas(porCodigo);
  const cesta = normalizarCesta(porItemCliente);
  const clientes = normalizarClientes(porCliente);

  // O relatório por código não traz data da nota: a semana é a da coleta.
  const semanaAtual = semanaISO(fim);
  await redis.set(vendaKey(semanaAtual), vendas);
  const semCesta = await gravarSemanas(cestaKey, cesta, (r) => (r.data ? semanaISO(r.data) : null));
  await redis.set(clienteKey(semanaAtual), clientes);

  const semanas = await registrarSemanas([semanaAtual, ...semCesta]);
  await fundirMeta({
    vendas: {
      em: new Date().toISOString(), inicio, fim,
      codigos: vendas.length, cesta: cesta.length, clientes: clientes.length,
    },
  });
  return { codigos: vendas.length, cesta: cesta.length, clientes: clientes.length, semanas: semanas.length };
}
