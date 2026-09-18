import { redis } from "@/lib/redis";
import { postRelatorio, type RawRow } from "@/lib/microwork";

// Histórico de compras de peças por cliente.
//
// O relatório do Microwork devolve uma linha por item de nota; aqui a compra é
// a NOTA (doctofiscal), com o valor somado dos itens. Guardamos só as 3 últimas
// compras de cada cliente, não o extrato inteiro: é o que o painel do vendedor
// mostra, e mantém a base pequena o bastante para caber em poucas chaves.
//
// Atacado e varejo ficam em listas separadas porque quem pergunta "qual foi a
// última compra dele" no painel do atacado quer a última compra DE ATACADO.

export type Grupo = "atacado" | "varejo";

export interface Compra {
  nota:  string;
  data:  string;   // AAAA-MM-DD
  valor: number;
}
export interface ClientePecas {
  documento: string;   // só dígitos
  nome:      string;
  empresa:   string;   // CGR / TEM — última compra
  atacado:   Compra[];
  varejo:    Compra[];
}

export const MAX_COMPRAS = 3;
const SHARDS = 10;
const shardKey = (n: number) => `pos:pecas:base:${n}`;
const META_KEY = "pos:pecas:meta";

const s = (v: unknown) => (v == null ? "" : String(v)).trim();
const soDigitos = (v: unknown) => s(v).replace(/\D/g, "");
const shardDe = (doc: string) => Number(doc.slice(-1)) % SHARDS || 0;

/** Atacado inclui venda para outra concessionária; boutique conta como varejo. */
export function grupoDe(descricao: string): Grupo {
  const d = descricao.toUpperCase();
  return d.includes("ATACADO") || d.includes("CONCESSION") ? "atacado" : "varejo";
}

function ordenarECortar(compras: Compra[]): Compra[] {
  const porNota = new Map<string, Compra>();
  for (const c of compras) porNota.set(c.nota || `${c.data}-${c.valor}`, c);
  return [...porNota.values()]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, MAX_COMPRAS);
}

/** Agrega as linhas cruas do relatório em um cliente por documento. */
export function agregar(linhas: RawRow[]): Map<string, ClientePecas> {
  const notas = new Map<string, { doc: string; nome: string; empresa: string; grupo: Grupo; nota: string; data: string; valor: number }>();

  for (const l of linhas) {
    const doc = soDigitos(l.cpfoucnpj);
    const data = s(l.dataemissaodoctofiscal).slice(0, 10);
    if (!doc || !/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    const nota  = s(l.doctofiscal);
    const grupo = grupoDe(s(l.descricaomercadoriamovimentotipo));
    const chave = `${doc}|${grupo}|${nota}|${data}`;
    const valor = Number(l.valortotalrequisicaoitem) || 0;
    const atual = notas.get(chave);
    if (atual) atual.valor += valor;
    else notas.set(chave, { doc, nome: s(l.nomeourazaosocial), empresa: s(l.empresa), grupo, nota, data, valor });
  }

  const clientes = new Map<string, ClientePecas>();
  for (const n of notas.values()) {
    const c = clientes.get(n.doc) ?? { documento: n.doc, nome: n.nome, empresa: n.empresa, atacado: [], varejo: [] };
    c[n.grupo].push({ nota: n.nota, data: n.data, valor: Math.round(n.valor * 100) / 100 });
    if (n.nome) c.nome = n.nome;
    c.empresa = n.empresa || c.empresa;
    clientes.set(n.doc, c);
  }
  for (const c of clientes.values()) {
    c.atacado = ordenarECortar(c.atacado);
    c.varejo  = ordenarECortar(c.varejo);
  }
  return clientes;
}

export async function lerBase(): Promise<Map<string, ClientePecas>> {
  const shards = await Promise.all(
    Array.from({ length: SHARDS }, (_, n) => redis.get<ClientePecas[]>(shardKey(n)))
  );
  const base = new Map<string, ClientePecas>();
  for (const lista of shards) for (const c of lista ?? []) base.set(c.documento, c);
  return base;
}

async function gravarBase(base: Map<string, ClientePecas>): Promise<void> {
  const shards: ClientePecas[][] = Array.from({ length: SHARDS }, () => []);
  for (const c of base.values()) shards[shardDe(c.documento)].push(c);
  await Promise.all(shards.map((lista, n) => redis.set(shardKey(n), lista)));
}

export interface MetaPecas { ultimaSync: string; ate: string; clientes: number }

export async function lerMeta(): Promise<MetaPecas | null> {
  return redis.get<MetaPecas>(META_KEY);
}

/** Busca o período no Microwork e funde na base, mantendo as 3 mais recentes. */
export async function sincronizarPecas(inicio: string, fim: string): Promise<{ linhas: number; clientes: number; total: number }> {
  const linhas = await getVendasPecasRaw(inicio, fim);
  const novos  = agregar(linhas);
  const base   = await lerBase();

  for (const [doc, novo] of novos) {
    const atual = base.get(doc);
    if (!atual) { base.set(doc, novo); continue; }
    base.set(doc, {
      documento: doc,
      nome:    novo.nome || atual.nome,
      empresa: novo.empresa || atual.empresa,
      atacado: ordenarECortar([...atual.atacado, ...novo.atacado]),
      varejo:  ordenarECortar([...atual.varejo,  ...novo.varejo]),
    });
  }

  await gravarBase(base);
  await redis.set(META_KEY, { ultimaSync: new Date().toISOString(), ate: fim, clientes: base.size } satisfies MetaPecas);
  return { linhas: linhas.length, clientes: novos.size, total: base.size };
}

const TIPO_MOVIMENTO = "37,702,409,38,742,496,351,264,380,235,39,438,293,322,467,1105,510,691,512,511,731,513,515,514,519,518,520,522,517,516,521,1108,52,53,687,412,267,499,354,727,296,325,441,383,238,54,470,1110,910,898,902,903,905,906,909,901,896,897,899,904,908,907,900,1142,394,41,42,220,40,696,736,481,336,249,452,423,365,278,307,1089";

export async function getVendasPecasRaw(inicio: string, fim: string): Promise<RawRow[]> {
  return postRelatorio({
    idrelatorioconfiguracao:       133,
    idrelatorioconsulta:           61,
    idrelatorioconfiguracaoleiaute: 133,
    idrelatoriousuarioleiaute:     839,
    filtros: [
      "IntermediacaoMarketplace=null",
      "Original=False",
      "TipoMercadoria=null",
      "MercadoriaPromocao=False",
      `DataConclusaoInicial=${inicio}`,
      `DataConclusaoFinal=${fim}`,
      "TipoOperacao=null",
      "Estoquista=null",
      "TipoDocumento=1,2",
      "Consultor=null",
      "Mercadoria=null",
      "ConsiderarItemCancelado=False",
      "MarcaMercadoria=null",
      "Vendedor=null",
      "Municipio=null",
      "Pessoa=null",
      `TipoMovimento=${TIPO_MOVIMENTO}`,
    ].join(";"),
  });
}
