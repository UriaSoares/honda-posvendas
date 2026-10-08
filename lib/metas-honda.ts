import { redis } from "@/lib/redis";
import { postRelatorio, type RawRow } from "@/lib/microwork";
import {
  agregarMes, agregarPassagens, resolverCamposOS, DEPARA_PADRAO, INDICADOR_IDS, numeroBR, resolverCampos, normChave as norm,
  type LinhaOS,
  type Campo,
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

/* ── Microwork: relatório de OS (passagens) ── */

export async function getOSRaw(inicio: string, fim: string): Promise<RawRow[]> {
  return postRelatorio({
    idrelatorioconfiguracao:        190,
    idrelatorioconsulta:            95,
    idrelatorioconfiguracaoleiaute: 190,
    idrelatoriousuarioleiaute:      956,
    filtros: [
      "SomenteMercadoriaOriginalFabrica=False",
      "ConsiderarTecnico=True",
      "SituacaoConcluidaNF=null",
      "VeiculoCliente=null",
      `Periododeemissaofinal=${fim}`,
      `Periododeemissaoinicial=${inicio}`,
      "Modelo=null",
      "Tipodeordemdeservico=null",
      "Consultor=null",
      "Tiposervico=null",
      "Tecnico=null",
      "NumeroOS=null",
      "Segmento=null",
      "OSSituacao=null",
      "ItensServicosCancelados=False",
      "Municipio=null",
      "NaoIncluirPessoa=null",
      "TipoRecepcao=null",
      "EstadoVeiculo=null",
      "TipoOrdemServicoInterno=null",
      "TipoBaixaDocumento=null",
      "NomeEmissaoDocumento=null",
      "TipoVeiculoOS=1,2",
      "Pessoa=null",
      "Tipoitem=1,2",
      "TipoDeVeiculoModelo=null",
      "GrupoDoModelo=null",
      "NumeroContratoFrotista=",
      "EquipeAtendimentoFrotista=null",
      "SomenteManutencaoFrotista=False",
      "FontePagadora=null",
      "NumeroColeta=",
    ].join(";"),
  });
}

const OBRIGATORIOS_OS = ["empresa", "numeroOS", "dataEmissao"] as const;

export function normalizarOS(raw: RawRow[]): LinhaOS[] {
  if (!raw.length) return [];
  const c = resolverCamposOS(Object.keys(raw[0]));
  const faltando = OBRIGATORIOS_OS.filter(f => !c[f]);
  if (faltando.length)
    throw new Error(`Relatório de OS: não achei os campos ${faltando.join(", ")}. Chaves recebidas: ${Object.keys(raw[0]).join(", ")}`);
  const g = (r: RawRow, f: keyof LinhaOS) => (c[f] ? r[c[f]!] : undefined);
  return raw.map(r => ({
    empresa:     s(g(r, "empresa")).toUpperCase(),
    numeroOS:    s(g(r, "numeroOS")).replace(/[[\]]/g, ""),
    dataEmissao: dataISO(g(r, "dataEmissao")),
    tipoOS:      s(g(r, "tipoOS")),
    situacao:    s(g(r, "situacao")),
    veiculo:     s(g(r, "veiculo")),
  })).filter(l => l.empresa === "CGR" || l.empresa === "TEM");
}

/** Passagens de vários meses; erro vira aviso para não derrubar o sync das compras. */
async function passagensPorMes(meses: string[], inicio: string, fim: string): Promise<{ porMes: Map<string, ReturnType<typeof agregarPassagens>>; aviso?: string; linhas: number }> {
  try {
    const linhas = normalizarOS(await getOSRaw(inicio, fim));
    return { porMes: new Map(meses.map(m => [m, agregarPassagens(linhas, m)])), linhas: linhas.length };
  } catch (e) {
    return { porMes: new Map(), aviso: `Passagens: ${String(e)}`, linhas: 0 };
  }
}

function juntar(real: RealMes, pas: ReturnType<typeof agregarPassagens> | undefined, aviso?: string): RealMes {
  for (const loja of ["CGR", "TEM"] as const) if (pas?.[loja]) real.lojas[loja].PASSAGENS = pas[loja];
  if (aviso) real.avisos = [...(real.avisos ?? []), aviso];
  return real;
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
export async function sincronizarReal(meses = 2): Promise<{ meses: string[]; linhas: number; os: number; avisos: string[] }> {
  const atual = mesAtual();
  const lista = Array.from({ length: meses }, (_, i) => somaMes(atual, -i));
  const inicio = `${somaMes(lista[lista.length - 1], -2)}-01`;
  const hoje = hojeCG();
  const [raw, pas] = await Promise.all([
    getComprasRaw(inicio, hoje),
    passagensPorMes(lista, `${lista[lista.length - 1]}-01`, hoje),
  ]);
  const linhas = normalizarLinhas(raw).filter(l => l.empresa === "CGR" || l.empresa === "TEM");
  const regras = await lerDePara();
  for (const mes of lista)
    await redis.set(K.real(mes), juntar(agregarMes(linhas, mes, regras), pas.porMes.get(mes), pas.aviso));
  return { meses: lista, linhas: linhas.length, os: pas.linhas, avisos: pas.aviso ? [pas.aviso] : [] };
}

/** Recalcula um mês fechado específico (ex.: carga histórica). */
export async function sincronizarMes(mes: string): Promise<{ linhas: number; os: number; avisos: string[] }> {
  const [raw, pas] = await Promise.all([
    getComprasRaw(`${somaMes(mes, -2)}-01`, fimDoMes(mes)),
    passagensPorMes([mes], `${mes}-01`, fimDoMes(mes)),
  ]);
  const linhas = normalizarLinhas(raw).filter(l => l.empresa === "CGR" || l.empresa === "TEM");
  await redis.set(K.real(mes), juntar(agregarMes(linhas, mes, await lerDePara()), pas.porMes.get(mes), pas.aviso));
  return { linhas: linhas.length, os: pas.linhas, avisos: pas.aviso ? [pas.aviso] : [] };
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
