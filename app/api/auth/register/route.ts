import { NextResponse }            from "next/server";
import bcrypt                      from "bcryptjs";
import { redis }                   from "@/lib/redis";
import { findUserByEmailAdmin, updateUser } from "@/lib/auth/users";
import type { InviteData }         from "@/app/api/admin/invite/route";

// GET /api/auth/register?token=xxx — valida convite e retorna dados
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token inválido." }, { status: 400 });

  const invite = await redis.get<InviteData>(`pos:invite:${token}`);
  if (!invite || invite.expiresAt < Date.now())
    return NextResponse.json({ error: "Link expirado ou inválido." }, { status: 410 });

  return NextResponse.json({ ok: true, name: invite.name, email: invite.email });
}

// POST /api/auth/register — completa o cadastro com senha própria
export async function POST(req: Request) {
  const { token, password } = await req.json() as { token?: string; password?: string };
  if (!token || !password) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Senha muito curta." }, { status: 400 });

  const invite = await redis.get<InviteData>(`pos:invite:${token}`);
  if (!invite || invite.expiresAt < Date.now())
    return NextResponse.json({ error: "Link expirado ou inválido." }, { status: 410 });

  const user = await findUserByEmailAdmin(invite.email);
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  const hash = await bcrypt.hash(password, 10);
  await updateUser(invite.email, { hash, mustChangePassword: false });
  await redis.del(`pos:invite:${token}`);

  return NextResponse.json({ ok: true });
}
