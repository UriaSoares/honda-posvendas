import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME, type SessionPayload } from "@/lib/auth/session";
import { getAttendant, getEmailByPhone } from "@/lib/whatsapp-store";

/** Sessão a partir do cookie — mesmo padrão das rotas admin. */
export async function getWaSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Resolve qual phoneNumberId o usuário pode acessar.
 * - qualidade: só o próprio número.
 * - gestao/admin: o próprio, ou qualquer número conectado via `requested`.
 * Retorna null se não tiver acesso (ou número não conectado).
 */
export async function resolvePhone(
  session: SessionPayload,
  requested: string | null,
): Promise<string | null> {
  const isManager = session.role === "admin" || session.role === "gestao";
  if (requested) {
    if (!isManager) {
      const mine = await getAttendant(session.email);
      return mine?.phoneNumberId === requested ? requested : null;
    }
    const owner = await getEmailByPhone(requested);
    return owner ? requested : null;
  }
  const mine = await getAttendant(session.email);
  return mine?.phoneNumberId ?? null;
}
