import { redis } from "@/lib/redis";

// Pipeline da Tabela de Manutenção / Preços / Óleo / Extras.
// Fonte da verdade = Google Sheets publicado em CSV. A equipe edita a planilha,
// o sistema sincroniza para o Redis (pos:manutencao:data) e o app lê de lá.

export type Loja = "CGR" | "BAR";
export type Categoria = "moto" | "scooter";

// Marcos de revisão da aba Preços.
export const REVISOES_KM = [1000, 6000, 12000, 18000, 24000, 30000] as const;

// URLs publicadas (CSV). Públicas — podem ficar no código; env sobrepõe se precisar.
const SHEET_URLS = {
  precos:  process.env.SHEET_PRECOS_URL  ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUyEpvbUtkuD4qxPt6skVTEqpdX0P3-7sqP4-TqdVBo_B4kyPEG-ZS_oRGRlFpD81g1gMtSJp6HSjD/pub?gid=0&single=true&output=csv",
  manut:   process.env.SHEET_MANUT_URL   ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUyEpvbUtkuD4qxPt6skVTEqpdX0P3-7sqP4-TqdVBo_B4kyPEG-ZS_oRGRlFpD81g1gMtSJp6HSjD/pub?gid=1185053200&single=true&output=csv",
  oleo:    process.env.SHEET_OLEO_URL    ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUyEpvbUtkuD4qxPt6skVTEqpdX0P3-7sqP4-TqdVBo_B4kyPEG-ZS_oRGRlFpD81g1gMtSJp6HSjD/pub?gid=360826983&single=true&output=csv",
  extras:  process.env.SHEET_EXTRAS_URL  ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUyEpvbUtkuD4qxPt6skVTEqpdX0P3-7sqP4-TqdVBo_B4kyPEG-ZS_oRGRlFpD81g1gMtSJp6HSjD/pub?gid=1545832967&single=true&output=csv",
};

// Modelos canônicos (de manutenção/óleo) em escopo — até a XRE 300 Sahara.
export const MODELOS_MANUT = [
  "POP 110i", "Biz 125", "Elite 125", "PCX 160", "ADV 160",
  "CG 160", "CG 160 Titan", "NXR 160 Bros", "XRE 190",
  "CB 300F Twister", "XRE 300 Sahara",
] as const;

// Categoria de óleo por modelo canônico (Moto vs Scooter).
export const CATEGORIA: Record<string, Categoria> = {
  "POP 110i": "moto", "Biz 125": "moto", "Elite 125": "scooter",
  "PCX 160": "scooter", "ADV 160": "scooter", "CG 160": "moto",
  "CG 160 Titan": "moto", "NXR 160 Bros": "moto", "XRE 190": "moto",
  "CB 300F Twister": "moto", "XRE 300 Sahara": "moto",
};

/**
 * De-para modelo de Preço → modelo de Manutenção/Óleo.
 * CG 160 Cargo/Fan compartilham óleo e manutenção com "CG 160".
 */
export function modeloManut(modeloPreco: string): string {
  const m = modeloPreco.trim();
  if (m === "CG 160 Cargo" || m === "CG 160 Fan") return "CG 160";
  return m;
}

/* ── Tipos do dataset ── */

export interface PrecoModelo {
  modelo: string;                       // nome da aba Preços (selecionável)
  precos: Record<string, number | null>; // km → preço (R$)
}
export interface OleoModelo {
  modelo: string;
  litragem: number | null;
}
export interface LitroTable {
  moto:    { CGR: number | null; BAR: number | null };
  scooter: { CGR: number | null; BAR: number | null };
}
export interface ItemManut {
  item: string;
  obs: string;
  valores: Record<string, { k1000: string; k6000: string; k12000: string; aCada: string }>;
}
export interface Extra {
  item: string;
  precoCGR: number | null;
  precoBAR: number | null;
  obs: string;
}
export interface ManutencaoData {
  syncedAt: number;
  precos:  PrecoModelo[];
  oleo:    { litro: LitroTable; modelos: OleoModelo[] };
  extras:  Extra[];
  manut:   { modelos: string[]; itens: ItemManut[] };
}

/* ── Helpers ── */

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Número no formato BR ("1.234,56") → 1234.56. Vazio → null.
function brNum(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (t === "") return null;
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

async function fetchCSV(url: string): Promise<string[][]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV ${res.status} em ${url}`);
  return parseCSV(await res.text());
}

const EM_ESCOPO = new Set<string>(MODELOS_MANUT);

/* ── Parsers por aba ── */

function parsePrecos(rows: string[][]): PrecoModelo[] {
  const header = rows[0] ?? [];           // ["", "1000", "6000", ...]
  const kms = header.slice(1).map((h) => h.trim());
  const out: PrecoModelo[] = [];
  for (const r of rows.slice(1)) {
    const modelo = (r[0] ?? "").trim();
    if (!modelo) continue;
    if (!EM_ESCOPO.has(modeloManut(modelo))) continue; // só até a Sahara
    const precos: Record<string, number | null> = {};
    kms.forEach((km, i) => { precos[km] = brNum(r[i + 1]); });
    out.push({ modelo, precos });
  }
  return out;
}

function parseOleo(rows: string[][]): { litro: LitroTable; modelos: OleoModelo[] } {
  const litro: LitroTable = { moto: { CGR: null, BAR: null }, scooter: { CGR: null, BAR: null } };
  const modelos: OleoModelo[] = [];
  for (const r of rows.slice(1)) {
    const modelo = (r[0] ?? "").trim();
    if (modelo && EM_ESCOPO.has(modeloManut(modelo))) {
      modelos.push({ modelo, litragem: brNum(r[1]) });
    }
    // mini-tabela de preço do litro nas colunas E/F
    const label = (r[4] ?? "").trim().toLowerCase();
    const val = brNum(r[5]);
    if (label.includes("moto") && label.includes("cgr")) litro.moto.CGR = val;
    else if (label.includes("scooter") && label.includes("cgr")) litro.scooter.CGR = val;
    else if (label.includes("moto") && label.includes("bar")) litro.moto.BAR = val;
    else if (label.includes("scooter") && label.includes("bar")) litro.scooter.BAR = val;
  }
  return { litro, modelos };
}

function parseExtras(rows: string[][]): Extra[] {
  return rows.slice(1)
    .filter((r) => (r[0] ?? "").trim())
    .map((r) => ({
      item: r[0].trim(),
      precoCGR: brNum(r[1]),
      precoBAR: brNum(r[2]),
      obs: (r[3] ?? "").trim(),
    }));
}

function parseManut(rows: string[][]): { modelos: string[]; itens: ItemManut[] } {
  // linha 0 = título; linha 1 = modelos (a cada 4 colunas); linha 2 = sub-headers
  const modelRow = rows[1] ?? [];
  const colMap: { modelo: string; col: number }[] = [];
  for (let c = 2; c < modelRow.length; c++) {
    const m = (modelRow[c] ?? "").trim();
    if (m && EM_ESCOPO.has(m)) colMap.push({ modelo: m, col: c });
  }
  const modelos = colMap.map((x) => x.modelo);
  const itens: ItemManut[] = [];
  for (const r of rows.slice(3)) {
    const item = (r[0] ?? "").trim();
    if (!item) continue;
    const valores: ItemManut["valores"] = {};
    for (const { modelo, col } of colMap) {
      valores[modelo] = {
        k1000:  (r[col]     ?? "").trim(),
        k6000:  (r[col + 1] ?? "").trim(),
        k12000: (r[col + 2] ?? "").trim(),
        aCada:  (r[col + 3] ?? "").trim(),
      };
    }
    itens.push({ item, obs: (r[1] ?? "").trim(), valores });
  }
  return { modelos, itens };
}

/* ── Sync e leitura ── */

const KEY = "pos:manutencao:data";

export async function syncManutencao(): Promise<ManutencaoData> {
  const [precosRows, manutRows, oleoRows, extrasRows] = await Promise.all([
    fetchCSV(SHEET_URLS.precos),
    fetchCSV(SHEET_URLS.manut),
    fetchCSV(SHEET_URLS.oleo),
    fetchCSV(SHEET_URLS.extras),
  ]);
  const data: ManutencaoData = {
    syncedAt: Date.now(),
    precos:   parsePrecos(precosRows),
    oleo:     parseOleo(oleoRows),
    extras:   parseExtras(extrasRows),
    manut:    parseManut(manutRows),
  };
  await redis.set(KEY, data);
  return data;
}

export async function getManutencao(): Promise<ManutencaoData | null> {
  return redis.get<ManutencaoData>(KEY);
}

/** Calcula o preço do óleo de um modelo numa loja: litragem × preço do litro (por categoria). */
export function precoOleo(
  data: ManutencaoData,
  modeloPreco: string,
  loja: Loja,
): number | null {
  const canon = modeloManut(modeloPreco);
  const o = data.oleo.modelos.find((m) => m.modelo === canon);
  if (!o || o.litragem == null) return null;
  const cat = CATEGORIA[canon];
  const litro = cat ? data.oleo.litro[cat][loja] : null;
  if (litro == null) return null;
  return Math.round(o.litragem * litro * 100) / 100;
}
