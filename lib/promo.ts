import { redis } from "@/lib/redis";

// Promoções do telão — até 4 slots, com rotação automática semanal.
// Config em pos:promo; imagens enviadas por upload ficam em pos:promo:img:{i}.

export interface PromoSlot {
  titulo: string;   // rótulo para o gestor identificar a promoção
  texto: string;    // texto opcional exibido junto
  imagem: string;   // URL externa (quando não for upload)
  upload: boolean;  // true = imagem enviada, servida por /api/display/promo-img/{i}
}
export interface PromoConfig { slots: PromoSlot[] }

const KEY = "pos:promo";
const imgKey = (i: number) => `pos:promo:img:${i}`;

function emptySlot(): PromoSlot { return { titulo: "", texto: "", imagem: "", upload: false }; }

export async function getPromo(): Promise<PromoConfig> {
  const raw = await redis.get<Record<string, unknown>>(KEY);
  if (raw && Array.isArray(raw.slots)) return { slots: raw.slots as PromoSlot[] };
  // migração do formato antigo { title, body }
  const slots = [emptySlot(), emptySlot(), emptySlot(), emptySlot()];
  if (raw && (raw.title || raw.body)) {
    slots[0] = { titulo: String(raw.title ?? ""), texto: String(raw.body ?? ""), imagem: "", upload: false };
  }
  return { slots };
}

export async function savePromo(cfg: PromoConfig): Promise<void> {
  await redis.set(KEY, cfg);
}
export async function setPromoImg(i: number, dataUrl: string): Promise<void> {
  await redis.set(imgKey(i), dataUrl);
}
export async function getPromoImg(i: number): Promise<string | null> {
  return redis.get<string>(imgKey(i));
}

/** Índices dos slots preenchidos (com upload, URL ou texto). */
export function slotsUsaveis(cfg: PromoConfig): number[] {
  return cfg.slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.upload || s.imagem.trim() || s.texto.trim())
    .map(({ i }) => i);
}

/** Semana corrente (avança a cada 7 dias) — usada para rotacionar os slots. */
export function semanaIndex(): number {
  return Math.floor(Date.now() / (7 * 86400 * 1000));
}

/** Índice do slot que deve estar no ar agora. Null se nenhum preenchido. */
export function slotAtual(cfg: PromoConfig): number | null {
  const usaveis = slotsUsaveis(cfg);
  if (usaveis.length === 0) return null;
  return usaveis[semanaIndex() % usaveis.length];
}
