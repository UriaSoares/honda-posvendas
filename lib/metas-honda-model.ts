// Metas Honda — modelo puro (sem Redis, sem fetch).
//
// Reproduz os indicadores de compra que a Honda mede no Tableau "KPI After Sales"
// e no IHS (PV Mensal de peças), a partir das linhas de pedido de compra do Microwork.
//
// Regras validadas contra os números da fábrica (out/2026):
//  - PV (card "PAV" no Tableau = compra de peças): fornecedor Moto Honda da Amazônia,
//    só pedidos ZREP e ZURB, valor = quantidade SOLICITADA × valor unitário, mês da
//    DATA DE EMISSÃO. Jan–set/2026 bateu em -0,09% no acumulado.
//  - Óleos: em LITROS (frasco = 1, tambor já vem com a quantidade em litros), qualquer
//    distribuidor (Cosan, Iconic…), qualquer classificação, mês da DATA DE COMPRA.
//    CGR 200 L e Barretos 240 L em out/2026 bateram exatamente.
//  - Kit Lub, Pneu, Bateria: em unidades, data de compra, conforme o de-para.
// "PAV" no Microwork é outra coisa (Pedido Avulso) e NÃO conta no PV.

export type LojaMeta = "CGR" | "TEM";
export const LOJAS_META: LojaMeta[] = ["CGR", "TEM"];

export type IndicadorId =
  | "TSI" | "PASSAGENS" | "FATURAMENTO"
  | "PV" | "PNEU" | "OLEO_10W30" | "OLEO_SCOOTER" | "OLEO_20W50" | "KIT_LUB" | "BATERIA";

export interface IndicadorDef {
  id:        IndicadorId;
  nome:      string;
  unidade:   "R$" | "L" | "un" | "nota" | "%" | "qtd";
  automatico: boolean;   // calculado a partir do Microwork
  /** Dias que a Honda leva para refletir a compra. Óleo: o Tableau das 13h de 08/10
   *  ainda não tinha a compra das 8h43 do mesmo dia → compara com o interno até D-1. */
  defasagem?: number;
}

/** Mesma ordem dos cards do Tableau (Campanhas, Leads e SLA ficam de fora: Salesforce não exporta). */
export const INDICADORES: IndicadorDef[] = [
  { id: "TSI",          nome: "TSI",            unidade: "nota", automatico: false },
  { id: "PASSAGENS",    nome: "Passagens",      unidade: "qtd",  automatico: true },
  { id: "FATURAMENTO",  nome: "Faturamento",    unidade: "R$",   automatico: false },
  { id: "PV",           nome: "Compra de Peças (PV)", unidade: "R$", automatico: true },
  { id: "PNEU",         nome: "Pneu",           unidade: "un",   automatico: true, defasagem: 1 },
  { id: "OLEO_10W30",   nome: "Óleo 10W30",     unidade: "L",    automatico: true, defasagem: 1 },
  { id: "OLEO_SCOOTER", nome: "Óleo Scooter",   unidade: "L",    automatico: true, defasagem: 1 },
  { id: "OLEO_20W50",   nome: "Óleo 20W50",     unidade: "L",    automatico: true, defasagem: 1 },
  { id: "KIT_LUB",      nome: "Kit Lub",        unidade: "un",   automatico: true, defasagem: 1 },
  { id: "BATERIA",      nome: "Bateria",        unidade: "un",   automatico: true, defasagem: 1 },
];
export const INDICADOR_IDS = new Set<string>(INDICADORES.map(i => i.id));

/* ── Linha de compra normalizada ── */

export interface LinhaCompra {
  empresa:       string;   // CGR / TEM / …
  pedido:        string;
  situacao:      string;
  dataEmissao:   string;   // AAAA-MM-DD
  dataCompra:    string;   // AAAA-MM-DD ("" se ainda não comprado)
  fornecedor:    string;
  codigoItem:    string;
  descricao:     string;
  quantidade:    number;   // solicitada
  valorUnitario: number;
  tipoPedido:    string;   // MERCADORIA PARA REVENDA / SERVIÇO DE TERCEIRO / …
  classificacao: string;   // "REPOSIÇÃO NORMAL HONDA [ZREP]"
}

export function siglaClassificacao(c: string): string {
  return /\[(\w+)\]/.exec(c)?.[1] ?? "";
}

/* ── Mapeamento dos campos do relatório de compras (Microwork 295) ── */

// Chaves cruas do relatório 295 (conferidas em produção em 08/10/2026):
// cpfoucnpjfornecedor, codigo, descricaoreduzida (empresa), situacao, dataemissao,
// fornecedor, codigoitem, datacompra, datarecebimento, descricaoitem, quantidade,
// quantidaderecebido, valorcompra (= valor UNITÁRIO), valortotalitem (= recebido × unitário),
// tipodepedido, classificacaopedidodecompra.
// O resolvedor tenta o nome exato primeiro e cai para padrões se o layout mudar.
// /api/metas-honda/debug mostra o resultado.
export type Campo = keyof LinhaCompra | "quantidadeRecebida" | "valorTotal";
export const normChave = (k: string) => k.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

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
  quantidadeRecebida: { contem: ["quantidaderecebid"] },
  valorUnitario:      { exato: ["valorcompra", "valorunitario"], contem: ["valorunitario"] },
  valorTotal:         { contem: ["valortotal"] },
  tipoPedido:         { exato: ["tipodepedido", "tipopedido"], contem: ["tipodepedido", "tipopedido"], evitar: ["id"] },
  classificacao:      { exato: ["classificacaopedidodecompra"], contem: ["classifica"] },
};

type Padroes<C extends string> = Record<C, { exato?: string[]; contem?: string[]; evitar?: string[] }>;

export function resolverCampos(chaves: string[]): Partial<Record<Campo, string>> {
  return resolverPorPadroes(chaves, PADROES);
}

function resolverPorPadroes<C extends string>(chaves: string[], padroes: Padroes<C>): Partial<Record<C, string>> {
  const out: Partial<Record<C, string>> = {};
  const usadas = new Set<string>();
  for (const campo of Object.keys(padroes) as C[]) {
    const p = padroes[campo];
    const candidatas = chaves.filter(k => !usadas.has(k));
    const ok = (k: string) => !(p.evitar ?? []).some(e => normChave(k).includes(e));
    const achou =
      candidatas.find(k => (p.exato ?? []).includes(normChave(k))) ??
      candidatas.find(k => ok(k) && (p.contem ?? []).some(c => normChave(k).includes(c)));
    if (achou) { out[campo] = achou; usadas.add(achou); }
  }
  return out;
}

/* ── De-para de produtos ── */

export interface RegraDePara {
  indicador:        IndicadorId;
  codigoItem?:      string;   // igual
  prefixoItem?:     string;   // começa com
  descricaoContem?: string;   // contém (maiúsculas)
  fornecedorContem?: string;  // contém (maiúsculas)
  conta:            boolean;  // entra na meta?
  fator:            number;   // multiplica a quantidade (ex.: caixa com 24 → 24)
  grupo?:           string;   // rótulo da quebra (marca/fornecedor); vazio = automático
  obs?:             string;
}

/**
 * De-para padrão. A primeira regra que casar vence — exclusões vêm antes.
 * Pode ser substituído pela aba "De-para" do Google Sheets.
 */
export const DEPARA_PADRAO: RegraDePara[] = [
  // Óleos Pro Honda (quantidade já vem em litros: frasco 1 L, tambor 200 L)
  { indicador: "OLEO_10W30",   codigoItem: "08233M99024", conta: true,  fator: 1, obs: "10W30 frasco" },
  { indicador: "OLEO_10W30",   codigoItem: "08233M99200", conta: true,  fator: 1, obs: "10W30 tambor" },
  { indicador: "OLEO_10W30",   codigoItem: "082342FS024", conta: false, fator: 1, obs: "10W30 Full Synthetic — confirmar se conta" },
  { indicador: "OLEO_SCOOTER", codigoItem: "082332MB024", conta: true,  fator: 1, obs: "Scooter 10W30 frasco" },
  { indicador: "OLEO_20W50",   codigoItem: "08233LUB205", conta: true,  fator: 1, obs: "20W50 frasco" },
  // Kit Lub — o kit Pro Honda conta; o Staff N321 não apareceu no Tableau
  { indicador: "KIT_LUB",      codigoItem: "06155LUB015", conta: true,  fator: 1, obs: "Kit Pro Honda corrente" },
  { indicador: "KIT_LUB",      codigoItem: "1000 019 321", conta: false, fator: 1, obs: "Kit Staff N321 — não conta" },
  // Pneus — Veipeças não conta; o resto (Pirelli, Levorin, Honda) conta
  { indicador: "PNEU", descricaoContem: "PNEU", fornecedorContem: "VEIPECAS", conta: false, fator: 1, obs: "Veipeças não conta" },
  { indicador: "PNEU", descricaoContem: "PNEU", conta: true, fator: 1 },
  // Baterias Honda
  { indicador: "BATERIA", prefixoItem: "31500", conta: true, fator: 1 },
  { indicador: "BATERIA", prefixoItem: "R315",  conta: true, fator: 1 },
];

const up = (s: string) => s.toUpperCase().trim();

export function regraPara(l: LinhaCompra, regras: RegraDePara[]): RegraDePara | null {
  const item = up(l.codigoItem), desc = up(l.descricao), forn = up(l.fornecedor);
  for (const r of regras) {
    if (r.codigoItem       && up(r.codigoItem) !== item) continue;
    if (r.prefixoItem      && !item.startsWith(up(r.prefixoItem))) continue;
    if (r.descricaoContem  && !desc.includes(up(r.descricaoContem))) continue;
    if (r.fornecedorContem && !forn.includes(up(r.fornecedorContem))) continue;
    if (!r.codigoItem && !r.prefixoItem && !r.descricaoContem && !r.fornecedorContem) continue;
    return r;
  }
  return null;
}

const MARCAS = ["PIRELLI", "LEVORIN", "VIPAL", "METZELER", "MICHELIN", "RINALDI", "TECHNIC", "MAGGION"];

/** Rótulo curto para a quebra: marca na descrição, senão 1ª palavra do fornecedor. */
export function grupoDe(l: LinhaCompra, r: RegraDePara | null): string {
  if (r?.grupo) return up(r.grupo);
  const d = up(l.descricao);
  const marca = MARCAS.find(m => d.includes(m));
  if (marca) return marca;
  const f = up(l.fornecedor);
  if (f.startsWith("MOTO HONDA")) return "HONDA";
  return f.split(/\s+/)[0] || "—";
}

/* ── Agregação ── */

export interface Agregado {
  total:       number;                   // o que conta na meta
  pedidos?:    number;                   // só PV
  veiculos?:   number;                   // só Passagens: chassis/placas distintos
  porGrupo:    Record<string, number>;   // conta, por marca/fornecedor
  foraPorGrupo: Record<string, number>;  // comprado mas não conta
  porDia:      Record<string, number>;   // "DD" → total do dia (conta)
}

export interface RealMes {
  mes:          string;                  // AAAA-MM
  atualizadoEm: string;                  // ISO
  linhas:       number;
  lojas:        Record<LojaMeta, Partial<Record<IndicadorId, Agregado>>>;
  avisos?:      string[];                // falhas parciais (ex.: relatório de OS fora do ar)
  naoMapeados:  { loja: string; codigoItem: string; descricao: string; fornecedor: string; quantidade: number }[];
}

const SUPPLIER_PV = "MOTO HONDA DA AMAZONIA";
const PV_CONTA = new Set(["ZREP", "ZURB"]);
const PARECE_INDICADOR = /OLEO|ÓLEO|LUBRIF|PNEU|BATERIA|KIT LUB/;
// Itens com cara de indicador que não são medidos (peça, graxa, óleo de corrente/suspensão)
const PARECE_PECA = /RETENTOR|FILTRO|BOMBA|ROTOR|VEDA|SELO|JUNTA|TAMPA|CAIXA|RESERVAT|VARETA|CABO|SUPORTE|CAMARA|CORRENTE|SUSPENS|GRAXA|DESENGRAX/;

function novo(): Agregado { return { total: 0, porGrupo: {}, foraPorGrupo: {}, porDia: {} }; }
const r2 = (n: number) => Math.round(n * 100) / 100;

export function agregarMes(linhas: LinhaCompra[], mes: string, regras: RegraDePara[]): RealMes {
  const lojas = { CGR: {}, TEM: {} } as RealMes["lojas"];
  const naoMap = new Map<string, RealMes["naoMapeados"][number]>();
  const pedidosPV: Record<LojaMeta, Set<string>> = { CGR: new Set(), TEM: new Set() };
  const get = (loja: LojaMeta, id: IndicadorId) => (lojas[loja][id] ??= novo());

  for (const l of linhas) {
    const loja = up(l.empresa) as LojaMeta;
    if (loja !== "CGR" && loja !== "TEM") continue;
    if (l.quantidade <= 0) continue;

    // PV — compra de peças Honda: data de emissão
    if (l.dataEmissao.startsWith(mes) && up(l.fornecedor).includes(SUPPLIER_PV)) {
      const sigla = siglaClassificacao(l.classificacao) || "SEM";
      const valor = l.quantidade * l.valorUnitario;
      const a = get(loja, "PV");
      if (PV_CONTA.has(sigla)) {
        a.total += valor;
        a.porGrupo[sigla] = (a.porGrupo[sigla] ?? 0) + valor;
        const dd = l.dataEmissao.slice(8, 10);
        a.porDia[dd] = (a.porDia[dd] ?? 0) + valor;
        pedidosPV[loja].add(l.pedido);
      } else {
        a.foraPorGrupo[sigla] = (a.foraPorGrupo[sigla] ?? 0) + valor;
      }
    }

    // Demais indicadores — revenda, data de compra (emissão se ainda não comprado)
    if (!up(l.tipoPedido).includes("REVENDA")) continue;
    const data = l.dataCompra || l.dataEmissao;
    if (!data.startsWith(mes)) continue;
    const regra = regraPara(l, regras);
    if (!regra) {
      const d = up(l.descricao);
      if (PARECE_INDICADOR.test(d) && !PARECE_PECA.test(d)) {
        const k = `${loja}|${l.codigoItem}`;
        const atual = naoMap.get(k);
        if (atual) atual.quantidade += l.quantidade;
        else naoMap.set(k, { loja, codigoItem: l.codigoItem, descricao: l.descricao, fornecedor: l.fornecedor, quantidade: l.quantidade });
      }
      continue;
    }
    const qtd = l.quantidade * (regra.fator || 1);
    const a = get(loja, regra.indicador);
    const g = grupoDe(l, regra);
    if (regra.conta) {
      a.total += qtd;
      a.porGrupo[g] = (a.porGrupo[g] ?? 0) + qtd;
      const dd = data.slice(8, 10);
      a.porDia[dd] = (a.porDia[dd] ?? 0) + qtd;
    } else {
      a.foraPorGrupo[g] = (a.foraPorGrupo[g] ?? 0) + qtd;
    }
  }

  for (const loja of LOJAS_META) {
    const pv = lojas[loja].PV;
    if (pv) pv.pedidos = pedidosPV[loja].size;
    for (const a of Object.values(lojas[loja])) {
      if (!a) continue;
      a.total = r2(a.total);
      for (const obj of [a.porGrupo, a.foraPorGrupo, a.porDia])
        for (const k of Object.keys(obj)) obj[k] = r2(obj[k]);
    }
  }

  return {
    mes, atualizadoEm: new Date().toISOString(), linhas: linhas.length, lojas,
    naoMapeados: [...naoMap.values()].sort((a, b) => b.quantidade - a.quantidade),
  };
}

/* ── Passagens (Microwork relatório 190 — OS da oficina) ── */

export interface LinhaOS {
  empresa:     string;
  numeroOS:    string;
  dataEmissao: string;   // AAAA-MM-DD
  tipoOS:      string;
  situacao:    string;
  veiculo:     string;   // chassi ou placa
}
export type CampoOS = keyof LinhaOS;

// Chaves ainda não conferidas em produção — /api/metas-honda/debug?fonte=os mostra o mapeamento.
const PADROES_OS: Padroes<CampoOS> = {
  empresa:     { exato: ["descricaoreduzida", "empresa", "siglaempresa"], contem: ["empresa"], evitar: ["cnpj", "idempresa"] },
  numeroOS:    { exato: ["numeroos", "numero", "os", "numeroordemservico", "codigoos", "idordemservico"], contem: ["numeroos", "ordemservico"], evitar: ["tipo", "situacao", "item", "interno"] },
  dataEmissao: { exato: ["dataemissao", "dataemissaoos"], contem: ["dataemissao", "emissao", "dataabertura"] },
  tipoOS:      { exato: ["tipoos", "tipodeordemdeservico", "tipoordemservico"], contem: ["tipoos", "tipodeordem", "tipoordem"], evitar: ["interno", "item", "veiculo"] },
  situacao:    { exato: ["ossituacao", "situacaoos", "situacao", "ospassagemsituacao"], contem: ["situacao"], evitar: ["item", "nf", "servico"] },
  veiculo:     { exato: ["chassi", "placa"], contem: ["chassi", "placa"] },
};
export function resolverCamposOS(chaves: string[]): Partial<Record<CampoOS, string>> {
  return resolverPorPadroes(chaves, PADROES_OS);
}

/**
 * Passagens = OS distintas abertas no mês (data de emissão), por loja.
 * O relatório traz uma linha por item da OS; aqui conta o número da OS uma vez.
 * Quebra por tipo de OS para calibrar contra o Tableau (ex.: se a Honda não conta OS interna).
 */
export function agregarPassagens(linhas: LinhaOS[], mes: string): Partial<Record<LojaMeta, Agregado>> {
  const out: Partial<Record<LojaMeta, Agregado>> = {};
  const vistos: Record<LojaMeta, Map<string, LinhaOS>> = { CGR: new Map(), TEM: new Map() };
  for (const l of linhas) {
    const loja = up(l.empresa) as LojaMeta;
    if ((loja !== "CGR" && loja !== "TEM") || !l.numeroOS || !l.dataEmissao.startsWith(mes)) continue;
    if (!vistos[loja].has(l.numeroOS)) vistos[loja].set(l.numeroOS, l);
  }
  for (const loja of LOJAS_META) {
    const os = [...vistos[loja].values()];
    if (!os.length) continue;
    const a = novo();
    const veic = new Set<string>();
    for (const l of os) {
      if (/CANCEL/i.test(l.situacao)) { const g = up(l.tipoOS) || "SEM TIPO"; a.foraPorGrupo[g] = (a.foraPorGrupo[g] ?? 0) + 1; continue; }
      a.total += 1;
      const g = up(l.tipoOS) || "SEM TIPO";
      a.porGrupo[g] = (a.porGrupo[g] ?? 0) + 1;
      const dd = l.dataEmissao.slice(8, 10);
      a.porDia[dd] = (a.porDia[dd] ?? 0) + 1;
      if (l.veiculo) veic.add(up(l.veiculo));
    }
    a.veiculos = veic.size;
    out[loja] = a;
  }
  return out;
}

/** Total acumulado até o dia DD (inclusive) — para comparar com a aferição daquele dia. */
export function acumuladoAte(a: Agregado | undefined, dia: number): number {
  if (dia < 1) return 0;
  if (!a) return 0;
  let s = 0;
  for (const [dd, v] of Object.entries(a.porDia)) if (Number(dd) <= dia) s += v;
  return r2(s);
}

/** Interno comparável a uma aferição feita no dia `dia`, descontada a defasagem da Honda. */
export function internoParaAfericao(def: IndicadorDef, a: Agregado | undefined, dia: number): { valor: number; ateDia: number } {
  const ateDia = dia - (def.defasagem ?? 0);
  return { valor: acumuladoAte(a, ateDia), ateDia };
}

/* ── Metas e aferição ── */

export interface Meta { mes: string; loja: LojaMeta; indicador: IndicadorId; meta: number }

export interface Afericao {
  id:        string;
  data:      string;        // AAAA-MM-DD
  loja:      LojaMeta;
  indicador: IndicadorId;
  valor:     number;        // número que a Honda mostra (Tableau / IHS)
  fonte:     "Tableau" | "IHS";
  autor:     string;
  criadoEm:  string;
}

/** "1.234,56", "1234,56", "1.255" (milhar BR) ou "1234.56" → número. */
export function numeroBR(v: unknown): number {
  if (typeof v === "number") return v;
  const t = String(v ?? "").trim().replace(/^R\$\s*/, "");
  if (!t) return NaN;
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t);
}

/* ── Calendário: dias úteis (seg–sáb, sem feriados) ── */

export function diasUteis(mes: string, ateDia?: number): number {
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const fim = Math.min(ateDia ?? ultimo, ultimo);
  let n = 0;
  for (let d = 1; d <= fim; d++) if (new Date(y, m - 1, d).getDay() !== 0) n++;
  return n;
}
