import { NextResponse }                from "next/server";
import { cookies }                   from "next/headers";
import { randomUUID }                from "crypto";
import bcrypt                        from "bcryptjs";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { createUser, findUserByEmailAdmin, defaultPassword } from "@/lib/auth/users";
import { redis }                     from "@/lib/redis";

export interface InviteData {
  name:       string;
  email:      string;
  createdBy:  string;
  expiresAt:  number; // unix ms
}

async function getSession() {
  const jar   = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// POST /api/admin/invite — cria convite para novo vendedor
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["admin", "gestao", "adm"].includes(session.role))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { name, email } = await req.json() as { name?: string; email?: string };
  if (!name?.trim() || !email?.trim())
    return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });

  const norm = email.toLowerCase().trim();
  const existing = await findUserByEmailAdmin(norm);
  if (existing) return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });

  // Cria o usuário imediatamente com senha padrão e mustChangePassword = true
  const pwd  = defaultPassword(name.trim().toUpperCase());
  const hash = await bcrypt.hash(pwd, 10);
  await createUser({
    email:              norm,
    name:               name.trim().toUpperCase(),
    role:               "qualidade",
    hash,
    mustChangePassword: true,
    active:             true,
  });

  // Gera token de convite (para a página de registro confirmar a conta)
  const token      = randomUUID();
  const expiresAt  = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 dias
  const inviteData: InviteData = { name: name.trim().toUpperCase(), email: norm, createdBy: session.email, expiresAt };
  await redis.set(`cnh:invite:${token}`, inviteData, { px: 7 * 24 * 60 * 60 * 1000 });

  return NextResponse.json({ ok: true, token, defaultPassword: pwd });
}
