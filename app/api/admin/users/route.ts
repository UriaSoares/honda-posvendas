import { NextResponse }                              from "next/server";
import { cookies }                                   from "next/headers";
import bcrypt                                        from "bcryptjs";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import { getAllUsers, updateUser, findUserByEmailAdmin, defaultPassword, type Role } from "@/lib/auth/users";

async function getSession() {
  const jar   = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["admin", "gestao"].includes(session.role))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const users = await getAllUsers();
  return NextResponse.json({ users: users.map((u) => ({ ...u, hash: undefined })) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { action, email, role } = await req.json() as {
    action: "setRole" | "deactivate" | "activate" | "resetPassword";
    email:  string;
    role?:  Role;
  };

  const callerRole = session.role;
  const target     = await findUserByEmailAdmin(email);
  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  if (action === "setRole") {
    if (callerRole !== "admin")
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    if (!role) return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    if (target.email === session.email)
      return NextResponse.json({ error: "Não é possível alterar sua própria função." }, { status: 400 });
    await updateUser(email, { role });
    return NextResponse.json({ ok: true });
  }

  if (action === "deactivate" || action === "activate") {
    if (callerRole === "qualidade")
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    if (callerRole === "gestao" && target.role === "admin")
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    await updateUser(email, { active: action === "activate" });
    return NextResponse.json({ ok: true });
  }

  if (action === "resetPassword") {
    if (!["admin", "gestao"].includes(callerRole))
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    if (callerRole !== "admin" && target.role === "admin")
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    if (callerRole === "admin" && target.email === session.email)
      return NextResponse.json({ error: "Use 'Alterar senha' para sua própria conta." }, { status: 400 });

    const pwd  = defaultPassword(target.name);
    const hash = await bcrypt.hash(pwd, 10);
    await updateUser(email, { hash, mustChangePassword: true });
    return NextResponse.json({ ok: true, defaultPassword: pwd });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
