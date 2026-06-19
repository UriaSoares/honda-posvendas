import { NextResponse }                        from "next/server";
import bcrypt                                  from "bcryptjs";
import { findUserByEmail }                     from "@/lib/auth/users";
import { createSessionToken, COOKIE_NAME, EXPIRES_IN } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json() as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.hash);
    if (!ok) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const token = await createSessionToken({ email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword });

    const res = NextResponse.json({
      ok:   true,
      name: user.name,
      role: user.role,
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   EXPIRES_IN,
    });

    return res;
  } catch (e) {
    console.error("[auth/login]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
