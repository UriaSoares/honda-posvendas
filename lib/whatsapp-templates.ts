// Mapa script ↔ template oficial da Meta.
// Fora da janela de 24h só é possível enviar templates aprovados. Cada script do
// roteiro (ver components/ScriptsPanel.tsx) ganha aqui um nome de template e a
// ordem das variáveis ({{1}}, {{2}}, {{3}}...).
//
// O `name` precisa ser idêntico ao template APROVADO no WhatsApp Manager.
// `varOrder` define quais variáveis preenchem {{1}}, {{2}}, ... naquela ordem.

export type TemplateVarKey = "nome" | "consultor" | "km";

export interface TemplateMap {
  /** id do contato no ScriptsPanel (índice em CONTACTS) */
  contactId: number;
  /** id do script dentro do contato (índice em scripts[]) */
  scriptId: number;
  /** nome do template aprovado na Meta */
  name: string;
  /** ordem das variáveis para {{1}}, {{2}}... */
  varOrder: TemplateVarKey[];
  /** idioma do template */
  lang: string;
}

// Convenção de nomes: fase_contato_variacao. Ajustar para bater 1:1 com a Meta.
export const TEMPLATES: TemplateMap[] = [
  // Contato 1 — Boas-vindas
  { contactId: 0, scriptId: 0, name: "boas_vindas_humanizado", varOrder: ["nome", "consultor"], lang: "pt_BR" },
  { contactId: 0, scriptId: 1, name: "boas_vindas_direto",     varOrder: ["nome"],               lang: "pt_BR" },

  // Contato 2 — Coffee Break
  { contactId: 1, scriptId: 0, name: "coffee_break_ajuste",    varOrder: ["nome", "consultor"], lang: "pt_BR" },
  { contactId: 1, scriptId: 1, name: "coffee_break_clube",     varOrder: ["nome"],               lang: "pt_BR" },
  { contactId: 1, scriptId: 2, name: "coffee_break_audio",     varOrder: ["nome"],               lang: "pt_BR" },

  // Contato 3 — 1ª Revisão
  { contactId: 2, scriptId: 0, name: "revisao1_garantia",      varOrder: ["nome", "consultor"], lang: "pt_BR" },
  { contactId: 2, scriptId: 1, name: "revisao1_5mes",          varOrder: ["nome"],               lang: "pt_BR" },

  // Contato 4 — 2ª Revisão
  { contactId: 3, scriptId: 0, name: "revisao2_cortesia",      varOrder: ["nome", "consultor"], lang: "pt_BR" },
  { contactId: 3, scriptId: 1, name: "revisao2_aniversario",   varOrder: ["nome"],               lang: "pt_BR" },

  // Contato 5 — 3ª Revisão
  { contactId: 4, scriptId: 0, name: "revisao3_financeiro",    varOrder: ["nome", "consultor"], lang: "pt_BR" },
  { contactId: 4, scriptId: 1, name: "revisao3_seguranca",     varOrder: ["nome"],               lang: "pt_BR" },

  // Ciclo fixo
  { contactId: 5, scriptId: 0, name: "ciclo_checkup",          varOrder: ["nome", "consultor", "km"], lang: "pt_BR" },
  { contactId: 5, scriptId: 1, name: "ciclo_checkup_ouro",     varOrder: ["nome"],                    lang: "pt_BR" },
];

export function findTemplate(contactId: number, scriptId: number): TemplateMap | null {
  return TEMPLATES.find((t) => t.contactId === contactId && t.scriptId === scriptId) ?? null;
}

/** Monta o array de variáveis na ordem certa a partir dos valores preenchidos. */
export function buildVars(
  tpl: TemplateMap,
  values: Partial<Record<TemplateVarKey, string>>,
): string[] {
  return tpl.varOrder.map((k) => values[k] ?? "");
}
