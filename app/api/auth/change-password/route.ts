import { NextResponse }                              from "next/server";
import { cookies }                                   from "next/headers";
import bcrypt                                        from "bcryptjs";
import { verifySessionToken, createSessionToken, COOKIE_NAME, EXPIRES_IN } from "@/lib/auth/session";
import { findUserByEmailAdmin, updateUser }          from "@/lib/auth/users";

export async function POST(req: Request) {
  const jar   = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const session = await verifySessionToken(token);
  if (!session)  return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const { currentPassword, newPassword } = await req.json() as {
    currentPassword?: string;
    newPassword?:     string;
  };

  if (!newPassword || newPassword.length < 6)
    return NextResponse.json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });

  const user = await findUserByEmailAdmin(session.email);
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  // Se não é primeiro acesso, exigir senha atual
  if (!session.mustChangePassword) {
    if (!currentPassword)
      return NextResponse.json({ error: "Informe a senha atual." }, { status: 400 });
    const ok = await bcrypt.compare(currentPassword, user.hash);
    if (!ok) return NextResponse.json({ error: "Senha atual incorreta." }, { status: 401 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await updateUser(session.email, { hash: newHash, mustChangePassword: false });

  // Emite novo token sem mustChangePassword
  const newToken = await createSessionToken({
    email:              user.email,
    name:               user.name,
    role:               user.role,
    mustChangePassword: false,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, newToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   EXPIRES_IN,
  });
  return res;
}
