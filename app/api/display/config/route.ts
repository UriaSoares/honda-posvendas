import { NextResponse } from "next/server";
import { getPublicDisplayConfig } from "@/lib/display-config";

// Público — usado pelo telão. Não expõe o PIN.
export async function GET() {
  const config = await getPublicDisplayConfig();
  return NextResponse.json({ config });
}
