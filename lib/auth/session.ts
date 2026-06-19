import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./users";

export interface SessionPayload {
  email:              string;
  name:               string;
  role:               Role;
  mustChangePassword: boolean;
}

const COOKIE_NAME = "posvendas_session";
const JWT_SECRET  = process.env.JWT_SECRET ?? "caioba-posvendas-secret-2026-change-in-production";
const secret      = new TextEncoder().encode(JWT_SECRET);
const EXPIRES_IN  = 8 * 60 * 60; // 8 horas (segundos)

/** Cria um JWT assinado */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(secret);
}

/** Verifica e decodifica o JWT */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      email:              payload.email              as string,
      name:               payload.name               as string,
      role:               payload.role               as Role,
      mustChangePassword: (payload.mustChangePassword as boolean) ?? false,
    };
  } catch {
    return null;
  }
}

export { COOKIE_NAME, EXPIRES_IN };
