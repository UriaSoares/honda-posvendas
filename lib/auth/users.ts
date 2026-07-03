import { redis } from "@/lib/redis";

export type Role = "admin" | "gestao" | "qualidade";
export type Loja = "CGR" | "TEM";

export interface AppUser {
  email:              string;
  name:               string;
  role:               Role;
  hash:               string;
  mustChangePassword: boolean;
  active:             boolean;
  lojas:              Loja[];   // relevante para role "qualidade"; admin/gestao sempre têm acesso às duas
  whatsapp?:           string;
}

/** Lojas efetivas do usuário: admin/gestao sempre têm acesso às duas. */
export function userLojas(user: Pick<AppUser, "role" | "lojas">): Loja[] {
  return user.role === "qualidade" ? (user.lojas ?? []) : ["CGR", "TEM"];
}

const SEED: Omit<AppUser, "mustChangePassword" | "active">[] = [
  { email: "uria@grupocaioba.com.br", name: "URIA SOARES", role: "admin", hash: "$2b$10$R1ISrfOKOvi11ldW8vd1u.IJvg3OlfeYf98HuQZ/FH9EhRJ6UBdsi", lojas: ["CGR", "TEM"] },
];

const rKey = (e: string) => `pos:user:${e.toLowerCase().trim()}`;
const SKEY = "pos:users";

async function ensureSeeded(seed: Omit<AppUser, "mustChangePassword" | "active">): Promise<AppUser> {
  const k        = rKey(seed.email);
  const existing = await redis.get<AppUser>(k);
  if (existing) return existing;
  const user: AppUser = { ...seed, mustChangePassword: false, active: true };
  await redis.set(k, user);
  await redis.sadd(SKEY, seed.email.toLowerCase().trim());
  return user;
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const stored = await redis.get<AppUser>(rKey(email));
  if (stored) return stored.active ? stored : null;
  const seed = SEED.find((u) => u.email === email.toLowerCase().trim());
  if (!seed) return null;
  return ensureSeeded(seed);
}

export async function findUserByEmailAdmin(email: string): Promise<AppUser | null> {
  const stored = await redis.get<AppUser>(rKey(email));
  if (stored) return stored;
  const seed = SEED.find((u) => u.email === email.toLowerCase().trim());
  if (!seed) return null;
  return ensureSeeded(seed);
}

export async function getAllUsers(): Promise<AppUser[]> {
  await Promise.all(SEED.map(ensureSeeded));
  const emails = await redis.smembers(SKEY);
  const users  = await Promise.all(emails.map((e) => redis.get<AppUser>(rKey(e))));
  const ORDER: Record<Role, number> = { admin: 0, gestao: 1, qualidade: 2 };
  return (users.filter(Boolean) as AppUser[]).sort(
    (a, b) => ORDER[a.role] - ORDER[b.role] || a.name.localeCompare(b.name),
  );
}

export async function updateUser(
  email: string,
  updates: Partial<Omit<AppUser, "email">>,
): Promise<AppUser | null> {
  const current = await findUserByEmailAdmin(email);
  if (!current) return null;
  const updated = { ...current, ...updates };
  await redis.set(rKey(email), updated);
  return updated;
}

export async function createUser(user: AppUser): Promise<void> {
  await redis.set(rKey(user.email), user);
  await redis.sadd(SKEY, user.email.toLowerCase().trim());
}

/** Migra o registro do usuário para um novo e-mail (chave primária). */
export async function renameUserEmail(oldEmail: string, newEmail: string): Promise<AppUser | null> {
  const current = await findUserByEmailAdmin(oldEmail);
  if (!current) return null;
  const normNew = newEmail.toLowerCase().trim();
  const updated = { ...current, email: normNew };
  await redis.set(rKey(normNew), updated);
  await redis.del(rKey(oldEmail));
  await redis.srem(SKEY, oldEmail.toLowerCase().trim());
  await redis.sadd(SKEY, normNew);
  return updated;
}

export function defaultPassword(name: string): string {
  const parts = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts[parts.length - 1]}`;
}
