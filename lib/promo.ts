import { redis } from "@/lib/redis";
import type { Loja } from "@/lib/auth/users";

// Promoções do telão — até 4 slots POR LOJA, com rotação automática semanal.
// Config em pos:promo:{loja}; imagens em pos:promo:img:{loja}:{i}.
// As chaves antigas (pos:promo e pos:promo:img:{i}) valem como herança para as
// duas lojas enquanto a loja não tiver config própria — assim o que já estava
// no ar não some quando essa separação entra.

export interface PromoSlot {
  titulo: string;   // rótulo para o gestor identificar a promoção
  texto: string;    // texto opcional exibido junto
  imagem: string;   // URL externa (quando não for upload)
  upload: boolean;  // true = imagem enviada, servida por /api/display/promo-img/{i}?loja=
}
export interface PromoConfig { slots: PromoSlot[] }

const KEY        = (loja: Loja) => `pos:promo:${loja}`;
const KEY_ANTIGA = "pos:promo";
const imgKey        = (loja: Loja, i: number) => `pos:promo:img:${loja}:${i}`;
const imgKeyAntiga  = (i: number) => `pos:promo:img:${i}`;

function emptySlot(): PromoSlot { return { titulo: "", texto: "", imagem: "", upload: false }; }

export async function getPromo(loja: Loja): Promise<PromoConfig> {
  const raw = (await redis.get<Record<string, unknown>>(KEY(loja)))
           ?? (await redis.get<Record<string, unknown>>(KEY_ANTIGA));
  if (raw && Array.isArray(raw.slots)) return { slots: raw.slots as PromoSlot[] };
  // migração do formato antigo { title, body }
  const slots = [emptySlot(), emptySlot(), emptySlot(), emptySlot()];
  if (raw && (raw.title || raw.body)) {
    slots[0] = { titulo: String(raw.title ?? ""), texto: String(raw.body ?? ""), imagem: "", upload: false };
  }
  return { slots };
}

export async function savePromo(loja: Loja, cfg: PromoConfig): Promise<void> {
  await redis.set(KEY(loja), cfg);
}
export async function setPromoImg(loja: Loja, i: number, dataUrl: string): Promise<void> {
  await redis.set(imgKey(loja, i), dataUrl);
}
export async function getPromoImg(loja: Loja, i: number): Promise<string | null> {
  return (await redis.get<string>(imgKey(loja, i))) ?? (await redis.get<string>(imgKeyAntiga(i)));
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
