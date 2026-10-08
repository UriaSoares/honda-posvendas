import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME, type SessionPayload } from "@/lib/auth/session";

export async function sessaoAtual(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

export function podeSincronizar(s: SessionPayload): boolean {
  return s.role === "admin" || s.role === "gestao";
}
