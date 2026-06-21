import { redis } from "@/lib/redis";

// Modelo de dados do WhatsApp no Redis (prefixo pos:wa:*).
// Cada atendente conecta o próprio número (Coexistência); o phoneNumberId é a
// chave de roteamento entre webhook, inbox e threads.

export interface AttendantLink {
  email:         string;
  phoneNumberId: string;
  wabaId:        string;
  displayNumber: string;
  status:        "connected" | "pending" | "disconnected";
  connectedAt:   number;
}

export interface WaMessage {
  id:        string;            // id da mensagem na Meta
  direction: "in" | "out";
  type:      "text" | "template";
  body:      string;
  timestamp: number;            // unix ms
  status?:   "sent" | "delivered" | "read" | "failed";
}

export interface WaContact {
  wa:               string;     // número do cliente (wa_id)
  nome:             string;
  ultimaMsg:        string;
  ultimaMsgAt:      number;
  naoLidas:         number;
  janela24hExpiraEm: number;    // unix ms — quando a janela de resposta livre fecha
}

const kAttendant = (email: string) => `pos:wa:attendant:${email.toLowerCase().trim()}`;
const kPhone     = (phoneNumberId: string) => `pos:wa:phone:${phoneNumberId}`;
const kInbox     = (phoneNumberId: string) => `pos:wa:inbox:${phoneNumberId}`;
const kThread    = (phoneNumberId: string, wa: string) => `pos:wa:thread:${phoneNumberId}:${wa}`;
const kContact   = (phoneNumberId: string, wa: string) => `pos:wa:contact:${phoneNumberId}:${wa}`;
const ATTENDANTS_SET = "pos:wa:attendants";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/* ── Vínculo atendente ↔ número ── */

export async function linkAttendant(link: AttendantLink): Promise<void> {
  await redis.set(kAttendant(link.email), link);
  await redis.set(kPhone(link.phoneNumberId), link.email.toLowerCase().trim());
  await redis.sadd(ATTENDANTS_SET, link.email.toLowerCase().trim());
}

export async function getAttendant(email: string): Promise<AttendantLink | null> {
  return redis.get<AttendantLink>(kAttendant(email));
}

export async function getEmailByPhone(phoneNumberId: string): Promise<string | null> {
  return redis.get<string>(kPhone(phoneNumberId));
}

export async function getAllAttendants(): Promise<AttendantLink[]> {
  const emails = await redis.smembers(ATTENDANTS_SET);
  const links  = await Promise.all(emails.map((e) => redis.get<AttendantLink>(kAttendant(e))));
  return (links.filter(Boolean) as AttendantLink[]).sort((a, b) =>
    a.email.localeCompare(b.email),
  );
}

/* ── Conversas / inbox ── */

export async function getInbox(phoneNumberId: string): Promise<WaContact[]> {
  // ordenado por última msg (score), mais recente primeiro
  const was = await redis.zrange<string[]>(kInbox(phoneNumberId), 0, 49, { rev: true });
  if (!was.length) return [];
  const contacts = await Promise.all(
    was.map((wa) => redis.get<WaContact>(kContact(phoneNumberId, wa))),
  );
  return contacts.filter(Boolean) as WaContact[];
}

export async function getThread(phoneNumberId: string, wa: string): Promise<WaMessage[]> {
  const raw = await redis.lrange<WaMessage>(kThread(phoneNumberId, wa), 0, -1);
  return raw ?? [];
}

export async function getContact(
  phoneNumberId: string,
  wa: string,
): Promise<WaContact | null> {
  return redis.get<WaContact>(kContact(phoneNumberId, wa));
}

/** Registra uma mensagem recebida e atualiza inbox/contato (reabre janela de 24h). */
export async function recordIncoming(
  phoneNumberId: string,
  wa: string,
  nome: string,
  msg: WaMessage,
): Promise<void> {
  await redis.rpush(kThread(phoneNumberId, wa), msg);
  const existing = await redis.get<WaContact>(kContact(phoneNumberId, wa));
  const contact: WaContact = {
    wa,
    nome:              nome || existing?.nome || wa,
    ultimaMsg:         msg.body,
    ultimaMsgAt:       msg.timestamp,
    naoLidas:          (existing?.naoLidas ?? 0) + 1,
    janela24hExpiraEm: msg.timestamp + WINDOW_MS,
  };
  await redis.set(kContact(phoneNumberId, wa), contact);
  await redis.zadd(kInbox(phoneNumberId), { score: msg.timestamp, member: wa });
}

/** Registra uma mensagem enviada por nós (append otimista). Não mexe na janela. */
export async function recordOutgoing(
  phoneNumberId: string,
  wa: string,
  msg: WaMessage,
): Promise<void> {
  await redis.rpush(kThread(phoneNumberId, wa), msg);
  const existing = await redis.get<WaContact>(kContact(phoneNumberId, wa));
  const contact: WaContact = {
    wa,
    nome:              existing?.nome ?? wa,
    ultimaMsg:         msg.body,
    ultimaMsgAt:       msg.timestamp,
    naoLidas:          existing?.naoLidas ?? 0,
    janela24hExpiraEm: existing?.janela24hExpiraEm ?? 0,
  };
  await redis.set(kContact(phoneNumberId, wa), contact);
  await redis.zadd(kInbox(phoneNumberId), { score: msg.timestamp, member: wa });
}

export async function markThreadRead(phoneNumberId: string, wa: string): Promise<void> {
  const existing = await redis.get<WaContact>(kContact(phoneNumberId, wa));
  if (!existing) return;
  await redis.set(kContact(phoneNumberId, wa), { ...existing, naoLidas: 0 });
}

export function janelaAberta(contact: WaContact | null): boolean {
  if (!contact) return false;
  return Date.now() < contact.janela24hExpiraEm;
}
