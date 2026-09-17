import type { Loja } from "@/lib/auth/users";

/** Loja vinda de query string ou corpo. Campo Grande é o padrão. */
export function lojaDaQuery(v: string | null | undefined): Loja {
  return String(v ?? "").toUpperCase() === "TEM" ? "TEM" : "CGR";
}
