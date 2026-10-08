import { redis } from "@/lib/redis";
import { postRelatorio, type RawRow } from "@/lib/microwork";
import {
  agregarMes, DEPARA_PADRAO, INDICADOR_IDS, numeroBR,
  type LinhaCompra, type RealMes, type RegraDePara, type Meta, type Afericao,
  type IndicadorId, type LojaMeta,
} from "@/lib/metas-honda-model";
import { METAS_PADRAO } from "@/lib/metas-honda-seed";

export * from "@/lib/metas-honda-model";

// Pipeline das Metas Honda.
//  - Real: relatório de Pedidos de Compra do Microwork (todos os fornecedores),
//    recalculado do zero a cada sync — sem upsert, então COMPRADO→RECEBIDO e
//    pedidos corrigidos se resolvem sozinhos.
//  - De-para e metas: Google Sheets publicado em CSV (env), com padrão no código.
//  - Aferição: lançada no portal, guardada no Redis por mês.

const K = {
  real:     (mes: string) => `pos:metas:real:${mes}`,
  afericao: (mes: string) => `pos:metas:afericao:${mes}`,
  metas:    "pos:metas:metas",
  depara:   "pos:metas:depara",
  sheets:   "pos:metas:sheets-meta",
};

const SHEET_DEPARA_URL = process.env.SHEET_METAS_DEPARA_URL ?? "";
const SHEET_METAS_URL  = process.env.SHEET_METAS_URL ?? "";

/* ── Microwork: relatório de pedidos de compra ── */

export async function getComprasRaw(inicio: string, fim: string): Promise<RawRow[]> {
  return postRelatorio({
    idrelatorioconfiguracao:        295,
    idrelatorioconsulta:            140,
    idrelatorioconfiguracaoleiaute: 295,
    idrelatoriousuarioleiaute:      968,
    filtros: [
      "Fornecedor=null",
      "PedidoFabrica=",
      `DataEmissaoInicial=${inicio}`,
      `DataEmissaoFinal=${fim}`,
      "Situacao=5,6",
      "Codigo=null",
      "TipoDePedido=null",
      "TipoItem=null",
      "CodigoMercadoria=null",
      "SomenteQuantidadePendente=False",
    ].join(";"),
  });
}

// As chaves cruas do relatório 295 ainda não foram mapeadas uma a uma (o layout
// exportado em CSV usa rótulos, a API usa nomes internos). O resolvedor procura a
// chave por padrão no nome normalizado. /api/metas-honda/debug mostra o resultado.
type Campo = keyof LinhaCompra | "quantidadeRecebida" | "valorTotal";
const norm = (k: string) => k.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

const PADROES: Record<Campo, { exato?: string[]; contem?: string[]; evitar?: string[] }> = {
  empresa:            { exato: ["empresa", "descricaoreduzida", "siglaempresa"], contem: ["empresa"], evitar: ["id", "cnpj"] },
  pedido:             { exato: ["codigo", "idpedidocompra", "codigopedido", "numeropedido"], contem: ["pedidocompra"], evitar: ["item", "mercadoria", "fabrica", "fornecedor", "tipo", "situacao", "classifica"] },
  situacao:           { exato: ["situacao"], contem: ["situacao"], evitar: ["id"] },
  dataEmissao:        { contem: ["dataemissao", "emissao"] },
  dataCompra:         { contem: ["datacompra", "datadecompra"] },
  fornecedor:         { exato: ["fornecedor", "nomefornecedor", "pessoafornecedor"], contem: ["fornecedor", "razaosocial"], evitar: ["cnpj", "cpf", "id", "documento"] },
  codigoItem:         { exato: ["codigoitem", "codigomercadoria"], contem: ["codigoitem", "codigomercadoria", "referencia"] },
  descricao:          { exato: ["descricao", "descricaomercadoria", "descricaoitem"], contem: ["descricaomercadoria", "descricaoitem"], evitar: ["tipo", "classifica", "situacao", "empresa", "reduzida"] },
  quantidade:         { exato: ["quantidade", "quantidadesolicitada", "quantidadepedida"], contem: ["quantidadesolicit", "quantidadepedid"], evitar: ["recebid", "pendente", "valor"] },
  quantidadeRecebida: { contem: ["quantidaderecebida"] },
  valorUnitario:      { contem: ["valorunitario"] },
  valorTotal:         { contem: ["valortotal"] },
  tipoPedido:         { exato: ["tipodepedido", "tipopedido"], contem: ["tipodepedido", "tipopedido"], evitar: ["id"] },
  classificacao:      { contem: ["classificacao", "classifica"], evitar: ["id"] },
};

export function resolverCampos(chaves: string[]): Partial<Record<Campo, string>> {
  const out: Partial<Record<Campo, string>> = {};
  const usadas = new Set<string>();
  for (const campo of Object.keys(PADROES) as Campo[]) {
    const p = PADROES[campo];
    const candidatas = chaves.filter(k => !usadas.has(k));
    const ok = (k: string) => !(p.evitar ?? []).some(e => norm(k).includes(e));
    const achou =
      candidatas.find(k => (p.exato ?? []).includes(norm(k))) ??
      candidatas.find(k => ok(k) && (p.contem ?? []).some(c => norm(k).includes(c)));
    if (achou) { out[campo] = achou; usadas.add(achou); }
  }
  return out;
}

const OBRIGATORIOS: Campo[] = ["empresa", "pedido", "dataEmissao", "fornecedor", "codigoItem", "descricao", "quantidade", "valorUnitario", "classificacao"];

const s = (v: unknown) => (v == null ? "" : String(v)).trim();

function numero(v: unknown): number {
  const n = numeroBR(v);
  return Number.isFinite(n) ? n : 0;
}

/** "2026-10-08T08:40:10", "2026-10-08 08:40" ou "08/10/2026 08:40:10" → "2026-10-08". */
export function dataISO(v: unknown): string {
  const t = s(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

export function normalizarLinhas(raw: RawRow[]): LinhaCompra[] {
  if (!raw.length) return [];
  const c = resolverCampos(Object.keys(raw[0]));
  const faltando = OBRIGATORIOS.filter(f => !c[f]);
  if (faltando.length)
    throw new Error(`Relatório de compras: não achei os campos ${faltando.join(", ")}. Chaves recebidas: ${Object.keys(raw[0]).join(", ")}`);
  const g = (r: RawRow, f: Campo) => (c[f] ? r[c[f]!] : undefined);
  return raw.map(r => ({
    empresa:       s(g(r, "empresa")).toUpperCase(),
    pedido:        s(g(r, "pedido")),
    situacao:      s(g(r, "situacao")),
    dataEmissao:   dataISO(g(r, "dataEmissao")),
    dataCompra:    dataISO(g(r, "dataCompra")),
    fornecedor:    s(g(r, "fornecedor")),
    codigoItem:    s(g(r, "codigoItem")),
    descricao:     s(g(r, "descricao")),
    quantidade:    numero(g(r, "quantidade")),
    valorUnitario: numero(g(r, "valorUnitario")),
    tipoPedido:    s(g(r, "tipoPedido")),
    classificacao: s(g(r, "classificacao")),
  }));
}

/* ── Datas (fuso de Campo Grande) ── */

export function hojeCG(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Campo_Grande" });
}
export function mesAtual(): string { return hojeCG().slice(0, 7); }
export function somaMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
function fimDoMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/* ── Google Sheets (CSV publicado) ── */

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function lerCSV(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheets ${res.status}`);
  const [cab, ...linhas] = parseCSV(await res.text());
  const h = (cab ?? []).map(norm);
  return linhas
    .filter(l => l.some(c => c.trim()))
    .map(l => Object.fromEntries(h.map((k, i) => [k, (l[i] ?? "").trim()])));
}

const simNao = (v: string) => !/^(n|nao|não|0|false)$/i.test(v.trim());

export function parseDePara(linhas: Record<string, string>[]): RegraDePara[] {
  const out: RegraDePara[] = [];
  for (const l of linhas) {
    const indicador = l.indicador?.toUpperCase() as IndicadorId;
    if (!INDICADOR_IDS.has(indicador)) continue;
    const r: RegraDePara = {
      indicador,
      codigoItem:       l.codigoitem || undefined,
      prefixoItem:      l.prefixoitem || undefined,
      descricaoContem:  l.descricaocontem || undefined,
      fornecedorContem: l.fornecedorcontem || undefined,
      conta:            simNao(l.conta ?? "SIM"),
      fator:            numero(l.fator) || 1,
      grupo:            l.grupo || undefined,
      obs:              l.obs || l.observacao || undefined,
    };
    if (r.codigoItem || r.prefixoItem || r.descricaoContem || r.fornecedorContem) out.push(r);
  }
  return out;
}

export function parseMetas(linhas: Record<string, string>[]): Meta[] {
  const out: Meta[] = [];
  for (const l of linhas) {
    const mes = /^\d{4}-\d{2}$/.test(l.mes ?? "") ? l.mes : "";
    const loja = (l.loja ?? "").toUpperCase() === "TEM" ? "TEM" : (l.loja ?? "").toUpperCase() === "CGR" ? "CGR" : "";
    const indicador = (l.indicador ?? "").toUpperCase() as IndicadorId;
    const meta = numero(l.meta);
    if (mes && loja && INDICADOR_IDS.has(indicador) && meta > 0) out.push({ mes, loja, indicador, meta });
  }
  return out;
}

export interface SheetsMeta { sincronizadoEm: string; depara: "sheets" | "padrao"; metas: "sheets" | "padrao"; erros: string[] }

export async function sincronizarSheets(): Promise<SheetsMeta> {
  const erros: string[] = [];
  let depara: SheetsMeta["depara"] = "padrao", metas: SheetsMeta["metas"] = "padrao";
  if (SHEET_DEPARA_URL) {
    try {
      const r = parseDePara(await lerCSV(SHEET_DEPARA_URL));
      if (r.length) { await redis.set(K.depara, r); depara = "sheets"; }
      else erros.push("De-para do Sheets veio vazio — usando o padrão.");
    } catch (e) { erros.push(`De-para: ${String(e)}`); }
  }
  if (SHEET_METAS_URL) {
    try {
      const m = parseMetas(await lerCSV(SHEET_METAS_URL));
      if (m.length) { await redis.set(K.metas, m); metas = "sheets"; }
      else erros.push("Metas do Sheets vieram vazias — usando o padrão.");
    } catch (e) { erros.push(`Metas: ${String(e)}`); }
  }
  if (depara === "padrao") await redis.del(K.depara);
  if (metas === "padrao") await redis.del(K.metas);
  const meta: SheetsMeta = { sincronizadoEm: new Date().toISOString(), depara, metas, erros };
  await redis.set(K.sheets, meta);
  return meta;
}

export async function lerDePara(): Promise<RegraDePara[]> {
  return (await redis.get<RegraDePara[]>(K.depara)) ?? DEPARA_PADRAO;
}
export async function lerMetas(mes: string): Promise<Meta[]> {
  const todas = (await redis.get<Meta[]>(K.metas)) ?? METAS_PADRAO;
  return todas.filter(m => m.mes === mes);
}
export async function lerSheetsMeta(): Promise<SheetsMeta | null> {
  return redis.get<SheetsMeta>(K.sheets);
}

/* ── Sync do real ── */

/**
 * Recalcula os `meses` mais recentes (padrão: atual e anterior). Busca a emissão
 * desde 2 meses antes do mais antigo, porque óleo é contado pela DATA DE COMPRA,
 * que pode cair semanas depois da emissão.
 */
export async function sincronizarReal(meses = 2): Promise<{ meses: string[]; linhas: number }> {
  const atual = mesAtual();
  const lista = Array.from({ length: meses }, (_, i) => somaMes(atual, -i));
  const inicio = `${somaMes(lista[lista.length - 1], -2)}-01`;
  const raw = await getComprasRaw(inicio, hojeCG());
  const linhas = normalizarLinhas(raw).filter(l => l.empresa === "CGR" || l.empresa === "TEM");
  const regras = await lerDePara();
  for (const mes of lista) await redis.set(K.real(mes), agregarMes(linhas, mes, regras));
  return { meses: lista, linhas: linhas.length };
}

/** Recalcula um mês fechado específico (ex.: carga histórica). */
export async function sincronizarMes(mes: string): Promise<{ linhas: number }> {
  const raw = await getComprasRaw(`${somaMes(mes, -2)}-01`, fimDoMes(mes));
  const linhas = normalizarLinhas(raw).filter(l => l.empresa === "CGR" || l.empresa === "TEM");
  await redis.set(K.real(mes), agregarMes(linhas, mes, await lerDePara()));
  return { linhas: linhas.length };
}

export async function lerReal(mes: string): Promise<RealMes | null> {
  return redis.get<RealMes>(K.real(mes));
}

/* ── Aferição ── */

export async function lerAfericoes(mes: string): Promise<Afericao[]> {
  return (await redis.get<Afericao[]>(K.afericao(mes))) ?? [];
}

export async function salvarAfericao(a: Omit<Afericao, "id" | "criadoEm">): Promise<Afericao> {
  const mes = a.data.slice(0, 7);
  const lista = await lerAfericoes(mes);
  const nova: Afericao = { ...a, id: crypto.randomUUID(), criadoEm: new Date().toISOString() };
  // Uma aferição por loja × indicador × dia × fonte: a nova substitui a anterior.
  const filtrada = lista.filter(x => !(x.loja === a.loja && x.indicador === a.indicador && x.data === a.data && x.fonte === a.fonte));
  await redis.set(K.afericao(mes), [...filtrada, nova]);
  return nova;
}

export async function removerAfericao(mes: string, id: string, autor: string, admin: boolean): Promise<boolean> {
  const lista = await lerAfericoes(mes);
  const alvo = lista.find(x => x.id === id);
  if (!alvo || (!admin && alvo.autor !== autor)) return false;
  await redis.set(K.afericao(mes), lista.filter(x => x.id !== id));
  return true;
}

export type { LojaMeta };
