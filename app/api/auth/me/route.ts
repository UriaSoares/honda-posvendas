import { NextResponse }                       from "next/server";
import { cookies }                            from "next/headers";
import { verifySessionToken, COOKIE_NAME }    from "@/lib/auth/session";

export async function GET() {
  const jar   = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ user: null });

  const session = await verifySessionToken(token);
  if (!session) return NextResponse.json({ user: null });

  return NextResponse.json({ user: session });
}
