import { NextResponse }                from "next/server";
import { cookies }                   from "next/headers";
import { randomUUID }                from "crypto";
import bcrypt                        from "bcryptjs";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { createUser, findUserByEmailAdmin, defaultPassword, type Role, type Loja } from "@/lib/auth/users";
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
  if (!["admin", "gestao"].includes(session.role))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { name, email, role, lojas, whatsapp } = await req.json() as {
    name?: string; email?: string; role?: Role; lojas?: Loja[]; whatsapp?: string;
  };
  if (!name?.trim() || !email?.trim())
    return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });

  // Gestão só pode convidar usuários do tipo Qualidade.
  const finalRole: Role = session.role === "gestao" ? "qualidade" : (role ?? "qualidade");

  let finalLojas: Loja[] = [];
  if (finalRole === "qualidade") {
    finalLojas = (lojas ?? []).filter((l): l is Loja => l === "CGR" || l === "TEM");
    if (finalLojas.length === 0)
      return NextResponse.json({ error: "Selecione ao menos uma loja para o usuário." }, { status: 400 });
  } else {
    finalLojas = ["CGR", "TEM"];
  }

  const norm = email.toLowerCase().trim();
  const existing = await findUserByEmailAdmin(norm);
  if (existing) return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });

  // Cria o usuário imediatamente com senha padrão e mustChangePassword = true
  const pwd  = defaultPassword(name.trim().toUpperCase());
  const hash = await bcrypt.hash(pwd, 10);
  await createUser({
    email:              norm,
    name:               name.trim().toUpperCase(),
    role:               finalRole,
    hash,
    mustChangePassword: true,
    active:             true,
    lojas:              finalLojas,
    whatsapp:           whatsapp?.trim() || undefined,
  });

  // Gera token de convite (para a página de registro confirmar a conta)
  const token      = randomUUID();
  const expiresAt  = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 dias
  const inviteData: InviteData = { name: name.trim().toUpperCase(), email: norm, createdBy: session.email, expiresAt };
  await redis.set(`pos:invite:${token}`, inviteData, { px: 7 * 24 * 60 * 60 * 1000 });

  return NextResponse.json({ ok: true, token, defaultPassword: pwd });
}
