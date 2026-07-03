import { NextResponse }                        from "next/server";
import bcrypt                                  from "bcryptjs";
import { findUserByEmail, userLojas }          from "@/lib/auth/users";
import { createSessionToken, COOKIE_NAME, EXPIRES_IN } from "@/lib/auth/session";
import { verifyTurnstile }                     from "@/lib/turnstile";

export async function POST(req: Request) {
  try {
    const { email, password, turnstileToken } = await req.json() as {
      email?: string; password?: string; turnstileToken?: string;
    };

    if (!email || !password) {
      return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
    }

    const captchaOk = await verifyTurnstile(turnstileToken, req.headers.get("x-forwarded-for") ?? undefined);
    if (!captchaOk) {
      return NextResponse.json({ error: "Verificação de segurança falhou. Tente novamente." }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.hash);
    if (!ok) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const token = await createSessionToken({
      email: user.email, name: user.name, role: user.role,
      mustChangePassword: user.mustChangePassword, lojas: userLojas(user),
    });

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
