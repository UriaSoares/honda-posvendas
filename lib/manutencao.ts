import { redis } from "@/lib/redis";
import {
  MODELOS_MANUT, modeloManut,
  type ManutencaoData, type PrecoModelo, type OleoModelo,
  type LitroTable, type ItemManut, type Extra, type TransparenciaItem,
} from "@/lib/manutencao-model";

// Pipeline da Tabela de Manutenção / Preços / Óleo / Extras.
// Fonte da verdade = Google Sheets publicado em CSV. A equipe edita a planilha,
// o sistema sincroniza para o Redis (pos:manutencao:data) e o app lê de lá.
// Tipos e helpers puros vivem em lib/manutencao-model.ts.

export * from "@/lib/manutencao-model";

// URLs publicadas (CSV). Públicas — podem ficar no código; env sobrepõe se precisar.
const SHEET_URLS = {
  precos:  process.env.SHEET_PRECOS_URL  ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUyEpvbUtkuD4qxPt6skVTEqpdX0P3-7sqP4-TqdVBo_B4kyPEG-ZS_oRGRlFpD81g1gMtSJp6HSjD/pub?gid=0&single=true&output=csv",
  manut:   process.env.SHEET_MANUT_URL   ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUyEpvbUtkuD4qxPt6skVTEqpdX0P3-7sqP4-TqdVBo_B4kyPEG-ZS_oRGRlFpD81g1gMtSJp6HSjD/pub?gid=1185053200&single=true&output=csv",
  oleo:    process.env.SHEET_OLEO_URL    ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUyEpvbUtkuD4qxPt6skVTEqpdX0P3-7sqP4-TqdVBo_B4kyPEG-ZS_oRGRlFpD81g1gMtSJp6HSjD/pub?gid=360826983&single=true&output=csv",
  extras:  process.env.SHEET_EXTRAS_URL  ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUyEpvbUtkuD4qxPt6skVTEqpdX0P3-7sqP4-TqdVBo_B4kyPEG-ZS_oRGRlFpD81g1gMtSJp6HSjD/pub?gid=1545832967&single=true&output=csv",
  transparencia: process.env.SHEET_TRANSP_URL ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUyEpvbUtkuD4qxPt6skVTEqpdX0P3-7sqP4-TqdVBo_B4kyPEG-ZS_oRGRlFpD81g1gMtSJp6HSjD/pub?gid=976982083&single=true&output=csv",
};

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
      modelos.push({ modelo, litragem: brNum(r[1]), precoCGR: brNum(r[2]), precoBAR: brNum(r[3]) });
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

function parseTransparencia(rows: string[][]): TransparenciaItem[] {
  return rows.slice(1)
    .filter(r => (r[1] ?? "").trim())   // precisa de descrição
    .map(r => ({ codigo: (r[0] ?? "").trim(), descricao: (r[1] ?? "").trim(), preco: (r[2] ?? "").trim() }));
}

/* ── Sync e leitura ── */

const KEY = "pos:manutencao:data";

export async function syncManutencao(): Promise<ManutencaoData> {
  const [precosRows, manutRows, oleoRows, extrasRows, transpRows] = await Promise.all([
    fetchCSV(SHEET_URLS.precos),
    fetchCSV(SHEET_URLS.manut),
    fetchCSV(SHEET_URLS.oleo),
    fetchCSV(SHEET_URLS.extras),
    fetchCSV(SHEET_URLS.transparencia),
  ]);
  const data: ManutencaoData = {
    syncedAt: Date.now(),
    precos:   parsePrecos(precosRows),
    oleo:     parseOleo(oleoRows),
    extras:   parseExtras(extrasRows),
    manut:    parseManut(manutRows),
    transparencia: parseTransparencia(transpRows),
  };
  await redis.set(KEY, data);
  return data;
}

export async function getManutencao(): Promise<ManutencaoData | null> {
  return redis.get<ManutencaoData>(KEY);
}
