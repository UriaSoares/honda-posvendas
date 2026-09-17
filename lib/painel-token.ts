import { timingSafeEqual } from "crypto";

// Token fixo de leitura dos endpoints /api/painel/*. Quem chama é um serviço
// (o painel do vendedor no WhatsApp), não uma pessoa — por isso não há sessão.

export function tokenValido(req: Request): boolean {
  const esperado = process.env.PAINEL_TOKEN;
  if (!esperado) return false; // sem token configurado, ninguém entra
  const recebido = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
