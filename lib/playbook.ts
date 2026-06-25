// Motor de playbook — "automação fake" por etiqueta.
// A partir da fase do cliente (e da objeção, se houver), decide qual script do
// roteiro (components/ScriptsPanel → CONTACTS) deve aparecer pra atendente.
// Função pura: sem React, sem Redis — reutilizável no cliente e no servidor.

export type FaseId =
  | "boas_vindas" | "coffee_break"
  | "revisao_1" | "revisao_2" | "revisao_3" | "ciclo";

export type ObjecaoId =
  | "preco" | "empurrando" | "tempo" | "mecanico" | "pensar";

export interface FaseDef {
  id: FaseId;
  label: string;
  contactId: number;   // índice em CONTACTS
  km: number | null;   // revisão correspondente (para puxar preço)
}

export interface ObjecaoDef {
  id: ObjecaoId;
  label: string;
  contactId: number;   // contato "Contornando Objeções" (6)
  scriptId: number;
}

// Fase → contato do roteiro + km da revisão (casamento com a aba Preços).
export const FASES: FaseDef[] = [
  { id: "boas_vindas",  label: "Boas-vindas",  contactId: 0, km: null  },
  { id: "coffee_break", label: "Coffee Break", contactId: 1, km: null  },
  { id: "revisao_1",    label: "1ª Revisão",   contactId: 2, km: 1000  },
  { id: "revisao_2",    label: "2ª Revisão",   contactId: 3, km: 6000  },
  { id: "revisao_3",    label: "3ª Revisão",   contactId: 4, km: 12000 },
  { id: "ciclo",        label: "Ciclo (6 em 6 mil)", contactId: 5, km: 18000 },
];

// Objeções (chips "o que o cliente disse") → script de contorno.
// Contato 6 = "Contornando Objeções": script 0 = financeira, 1 = reatância.
export const OBJECOES: ObjecaoDef[] = [
  { id: "preco",      label: "Tá caro",            contactId: 6, scriptId: 0 },
  { id: "empurrando", label: "Empurrando serviço", contactId: 6, scriptId: 1 },
  { id: "mecanico",   label: "Mecânico próprio",   contactId: 6, scriptId: 1 },
  { id: "tempo",      label: "Sem tempo",          contactId: 6, scriptId: 0 },
  { id: "pensar",     label: "Vou pensar",         contactId: 6, scriptId: 0 },
];

export interface Recomendacao { contactId: number; scriptId: number }

/** Decide o script recomendado a partir da fase e (opcional) da objeção registrada. */
export function recomendar(fase: FaseId | null, objecao: ObjecaoId | null): Recomendacao | null {
  if (objecao) {
    const o = OBJECOES.find((x) => x.id === objecao);
    if (o) return { contactId: o.contactId, scriptId: o.scriptId };
  }
  if (fase) {
    const f = FASES.find((x) => x.id === fase);
    if (f) return { contactId: f.contactId, scriptId: 0 };
  }
  return null;
}

export function faseDef(id: FaseId | null): FaseDef | null {
  return id ? FASES.find((f) => f.id === id) ?? null : null;
}
