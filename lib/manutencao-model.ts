// Parte PURA do modelo de manutenção (sem Redis) — segura para importar no cliente.
// lib/manutencao.ts importa daqui e acrescenta parsing/sync/Redis.

export type Loja = "CGR" | "BAR";
export type Categoria = "moto" | "scooter";

export const REVISOES_KM = [1000, 6000, 12000, 18000, 24000, 30000] as const;

export const MODELOS_MANUT = [
  "POP 110i", "Biz 125", "Elite 125", "PCX 160", "ADV 160",
  "CG 160", "CG 160 Titan", "NXR 160 Bros", "XRE 190",
  "CB 300F Twister", "XRE 300 Sahara",
] as const;

export const CATEGORIA: Record<string, Categoria> = {
  "POP 110i": "moto", "Biz 125": "moto", "Elite 125": "scooter",
  "PCX 160": "scooter", "ADV 160": "scooter", "CG 160": "moto",
  "CG 160 Titan": "moto", "NXR 160 Bros": "moto", "XRE 190": "moto",
  "CB 300F Twister": "moto", "XRE 300 Sahara": "moto",
};

/** De-para modelo de Preço → modelo de Manutenção/Óleo (CG 160 Cargo/Fan → CG 160). */
export function modeloManut(modeloPreco: string): string {
  const m = modeloPreco.trim();
  if (m === "CG 160 Cargo" || m === "CG 160 Fan") return "CG 160";
  return m;
}

export interface PrecoModelo {
  modelo: string;
  precos: Record<string, number | null>;
}
export interface OleoModelo {
  modelo: string;
  litragem: number | null;
  precoCGR: number | null;
  precoBAR: number | null;
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
export interface Extra { item: string; precoCGR: number | null; precoBAR: number | null; obs: string }
export interface TransparenciaItem { codigo: string; descricao: string; preco: string }
export interface ManutencaoData {
  syncedAt: number;
  precos:  PrecoModelo[];
  oleo:    { litro: LitroTable; modelos: OleoModelo[] };
  extras:  Extra[];
  manut:   { modelos: string[]; itens: ItemManut[] };
  transparencia?: TransparenciaItem[];
}

/** Preço do óleo de um modelo numa loja — lê direto da planilha (coluna Preço CGR/BAR). */
export function precoOleo(
  data: ManutencaoData,
  modeloPreco: string,
  loja: Loja,
): number | null {
  const canon = modeloManut(modeloPreco);
  const o = data.oleo.modelos.find((m) => m.modelo === canon);
  if (!o) return null;
  return loja === "CGR" ? o.precoCGR : o.precoBAR;
}
