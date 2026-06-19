import { NextRequest, NextResponse } from "next/server";
import { jwtVerify }                 from "jose";

const PUBLIC_PATHS  = ["/login", "/register", "/display", "/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/display", "/api/admin/promo"];
const COOKIE_NAME   = "posvendas_session";
const secret        = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "caioba-posvendas-secret-2026-change-in-production"
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, secret);

    if (payload.mustChangePassword && pathname !== "/change-password") {
      const url = req.nextUrl.clone();
      url.pathname = "/change-password";
      return NextResponse.redirect(url);
    }

    const res = NextResponse.next();
    res.headers.set("x-user-email", String(payload.email ?? ""));
    res.headers.set("x-user-name",  String(payload.name  ?? ""));
    res.headers.set("x-user-role",  String(payload.role  ?? ""));
    return res;
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
