import { redis } from "@/lib/redis";
import type { Loja } from "@/lib/auth/users";

// Promoção da semana do ATACADO — separada por loja e consumida pelo painel do
// vendedor no WhatsApp (GET /api/painel/promocao-semana).
// Os textos são as variações que o VENDEDOR copia; nunca levam dado de cliente.

export interface PromoAtacadoSlot {
  titulo:    string;
  descricao: string;   // contexto curto para o vendedor
  imagem:    string;   // URL externa (quando não for upload)
  upload:    boolean;  // true = arte enviada, servida por /api/painel/promo-img/{loja}/{i}
  inicio:    string;   // AAAA-MM-DD
  fim:       string;   // AAAA-MM-DD
  textos:    string[]; // 3 variações
}
export interface PromoAtacadoConfig { slots: PromoAtacadoSlot[] }

export const SLOTS = 4;
export const TEXTOS_POR_SLOT = 3;

const KEY    = (loja: Loja) => `pos:promo-atacado:${loja}`;
const imgKey = (loja: Loja, i: number) => `pos:promo-atacado:img:${loja}:${i}`;

export function slotVazio(): PromoAtacadoSlot {
  return { titulo: "", descricao: "", imagem: "", upload: false, inicio: "", fim: "", textos: ["", "", ""] };
}

export function normalizar(s: Partial<PromoAtacadoSlot>): PromoAtacadoSlot {
  const textos = Array.isArray(s.textos) ? s.textos.slice(0, TEXTOS_POR_SLOT).map(t => String(t ?? "")) : [];
  while (textos.length < TEXTOS_POR_SLOT) textos.push("");
  return {
    titulo:    String(s.titulo ?? ""),
    descricao: String(s.descricao ?? ""),
    imagem:    String(s.imagem ?? ""),
    upload:    !!s.upload,
    inicio:    String(s.inicio ?? ""),
    fim:       String(s.fim ?? ""),
    textos,
  };
}

export async function getPromoAtacado(loja: Loja): Promise<PromoAtacadoConfig> {
  const raw = await redis.get<Record<string, unknown>>(KEY(loja));
  const slots = Array.isArray(raw?.slots) ? (raw!.slots as Partial<PromoAtacadoSlot>[]).map(normalizar) : [];
  while (slots.length < SLOTS) slots.push(slotVazio());
  return { slots: slots.slice(0, SLOTS) };
}

export async function savePromoAtacado(loja: Loja, cfg: PromoAtacadoConfig): Promise<void> {
  await redis.set(KEY(loja), { slots: cfg.slots.slice(0, SLOTS).map(normalizar) });
}
export async function setPromoAtacadoImg(loja: Loja, i: number, dataUrl: string): Promise<void> {
  await redis.set(imgKey(loja, i), dataUrl);
}
export async function getPromoAtacadoImg(loja: Loja, i: number): Promise<string | null> {
  return redis.get<string>(imgKey(loja, i));
}

const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;

/** Está no ar hoje? Sem datas = fora do ar (o painel só aceita AAAA-MM-DD). */
export function noAr(s: PromoAtacadoSlot, hoje: string): boolean {
  if (!DATA_OK.test(s.inicio) || !DATA_OK.test(s.fim)) return false;
  if (hoje < s.inicio || hoje > s.fim) return false;
  return s.textos.some(t => t.trim()) || !!s.titulo.trim();
}
