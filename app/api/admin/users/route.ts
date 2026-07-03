import { NextResponse }                              from "next/server";
import { cookies }                                   from "next/headers";
import bcrypt                                        from "bcryptjs";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import {
  getAllUsers, updateUser, findUserByEmailAdmin, defaultPassword, renameUserEmail,
  type Role, type Loja,
} from "@/lib/auth/users";

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

interface EditBody {
  action: "setRole" | "deactivate" | "activate" | "resetPassword" | "edit";
  email:  string;
  role?:  Role;
  updates?: {
    name?:     string;
    email?:    string;
    role?:     Role;
    active?:   boolean;
    whatsapp?: string;
    lojas?:    Loja[];
  };
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { action, email, role, updates } = await req.json() as EditBody;

  const callerRole = session.role;
  const target      = await findUserByEmailAdmin(email);
  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  // Todas as ações abaixo (mudar função, ativar/desativar, resetar senha, editar)
  // são exclusivas do Admin. Gestão só visualiza a lista e convida usuários Qualidade.
  if (callerRole !== "admin")
    return NextResponse.json({ error: "Apenas o Admin pode gerenciar usuários." }, { status: 403 });

  if (action === "edit") {
    if (!updates) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    if ((updates.role || updates.active === false) && target.email === session.email)
      return NextResponse.json({ error: "Não é possível alterar a própria função ou desativar a própria conta." }, { status: 400 });

    const finalRole = updates.role ?? target.role;
    let finalLojas  = target.lojas;
    if (updates.lojas) {
      finalLojas = updates.lojas.filter((l) => l === "CGR" || l === "TEM");
    }
    if (finalRole === "qualidade" && (!finalLojas || finalLojas.length === 0))
      return NextResponse.json({ error: "Selecione ao menos uma loja para um usuário Qualidade." }, { status: 400 });
    if (finalRole !== "qualidade") finalLojas = ["CGR", "TEM"];

    let workingEmail = target.email;
    if (updates.email && updates.email.toLowerCase().trim() !== target.email) {
      const newNorm = updates.email.toLowerCase().trim();
      const clash = await findUserByEmailAdmin(newNorm);
      if (clash) return NextResponse.json({ error: "Já existe um usuário com esse e-mail." }, { status: 409 });
      const renamed = await renameUserEmail(target.email, newNorm);
      if (!renamed) return NextResponse.json({ error: "Erro ao migrar e-mail." }, { status: 500 });
      workingEmail = newNorm;
    }

    const updated = await updateUser(workingEmail, {
      name:     updates.name?.trim() ? updates.name.trim().toUpperCase() : target.name,
      role:     finalRole,
      active:   updates.active ?? target.active,
      whatsapp: updates.whatsapp?.trim() || undefined,
      lojas:    finalLojas,
    });
    return NextResponse.json({ ok: true, user: updated ? { ...updated, hash: undefined } : null });
  }

  if (action === "setRole") {
    if (!role) return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    if (target.email === session.email)
      return NextResponse.json({ error: "Não é possível alterar sua própria função." }, { status: 400 });
    await updateUser(email, { role });
    return NextResponse.json({ ok: true });
  }

  if (action === "deactivate" || action === "activate") {
    await updateUser(email, { active: action === "activate" });
    return NextResponse.json({ ok: true });
  }

  if (action === "resetPassword") {
    if (target.email === session.email)
      return NextResponse.json({ error: "Use 'Alterar senha' para sua própria conta." }, { status: 400 });
    const pwd  = defaultPassword(target.name);
    const hash = await bcrypt.hash(pwd, 10);
    await updateUser(email, { hash, mustChangePassword: true });
    return NextResponse.json({ ok: true, defaultPassword: pwd });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
