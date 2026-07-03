// Verificação server-side do Cloudflare Turnstile.
// A chave secreta nunca é exposta ao navegador — só a Site Key (pública) vai no front.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token: string | undefined, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Sem chave configurada: não bloqueia o login (evita lockout em dev/preview).
    console.warn("[turnstile] TURNSTILE_SECRET_KEY não configurado — captcha não verificado.");
    return true;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body });
    const data = await res.json() as { success: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}
