import { redis } from "@/lib/redis";

// Configuração do telão da recepção (editável pelo supervisor no ADM).
// Guardado num único blob no Redis: pos:display:config

export interface Membro { cargo: string; nome: string }
export interface Contato { cargo: string; nome: string; email?: string; telefone?: string }
export interface LojaInfo { nome: string; contatos: Contato[] }

export interface DisplayConfig {
  pin: string;                       // 4 dígitos numéricos
  horarios: { label: string; horario: string }[];
  equipe: { CGR: Membro[][]; TEM: Membro[][] };   // cada nível = uma linha do organograma
  info:   { CGR: LojaInfo; TEM: LojaInfo };
}

const KEY = "pos:display:config";

// Organograma padrão (nomes a preencher pelo supervisor).
function equipePadrao(): Membro[][] {
  return [
    [{ cargo: "Direção da Empresa", nome: "" }],
    [{ cargo: "Gerente de Loja", nome: "" }, { cargo: "Gerente Geral de Pós-Vendas", nome: "Deyvid Maycon Alves da Silva" }],
    [{ cargo: "Gerente de Pós-Vendas", nome: "" }],
    [{ cargo: "Mecânico Líder", nome: "" }],
    [
      { cargo: "Consultor 1", nome: "" }, { cargo: "Consultor 2", nome: "" }, { cargo: "Consultor 3", nome: "" },
      { cargo: "Mecânico 1", nome: "" }, { cargo: "Mecânico 2", nome: "" }, { cargo: "Mecânico 3", nome: "" },
    ],
  ];
}

export const DEFAULT_CONFIG: DisplayConfig = {
  pin: "1234",
  horarios: [
    { label: "Segunda a Sexta", horario: "07:30 às 18:00" },
    { label: "Sábado",          horario: "07:30 às 12:00" },
  ],
  equipe: { CGR: equipePadrao(), TEM: equipePadrao() },
  info: {
    TEM: {
      nome: "Barretos",
      contatos: [
        { cargo: "Gerente Geral de Pós-Vendas", nome: "Deyvid Maycon Alves da Silva", email: "super_oficina@caiobahonda.com.br" },
        { cargo: "Gerente de Pós-Vendas", nome: "Sheila da Silva Amancio", email: "superoficina_barretos@caiobahonda.com.br", telefone: "(17) 3321-5540 — Ramal 3703" },
        { cargo: "Gerente Geral de Loja", nome: "Ana Cecilia Campos de Castro Garcia", email: "gerenciabarretos@caiobahonda.com.br", telefone: "(17) 3321-5540 — Ramal 3101" },
      ],
    },
    CGR: {
      nome: "Campo Grande",
      contatos: [
        { cargo: "Gerente Geral de Pós-Vendas", nome: "Deyvid Maycon Alves da Silva", email: "super_oficina@caiobahonda.com.br" },
        { cargo: "Gerente Geral de Loja", nome: "Marcia Maria Guerra Soares", email: "gerenciazahran@caiobahonda.com.br", telefone: "(67) 3345-1000 — Ramal 2101" },
      ],
    },
  },
};

export async function getDisplayConfig(): Promise<DisplayConfig> {
  const stored = await redis.get<DisplayConfig>(KEY);
  return stored ?? DEFAULT_CONFIG;
}

export async function saveDisplayConfig(cfg: DisplayConfig): Promise<void> {
  await redis.set(KEY, cfg);
}

/** Config pública do telão (sem o PIN). */
export async function getPublicDisplayConfig(): Promise<Omit<DisplayConfig, "pin">> {
  const { pin: _pin, ...rest } = await getDisplayConfig();
  void _pin;
  return rest;
}
