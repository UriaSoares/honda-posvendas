import type { Meta, IndicadorId, LojaMeta } from "@/lib/metas-honda-model";

// Metas padrão, usadas enquanto a aba "Metas" do Google Sheets (SHEET_METAS_URL)
// não estiver configurada. Fontes:
//  - PV CGR jan–out/2026: portal Honda IHS (IJPA2143, Valor do PAC), 08/10/2026.
//  - Demais out/2026: Tableau KPI After Sales, prints de 08/10/2026 13:25.
//    Valores mostrados em "K" no Tableau (Faturamento, PV TEM) são aproximados.

const PV_CGR: [string, number][] = [
  ["2026-01", 194976.68], ["2026-02", 194976.68], ["2026-03", 194976.68],
  ["2026-04", 186598.78], ["2026-05", 197769.32], ["2026-06", 206147.22],
  ["2026-07", 229757.68], ["2026-08", 233311.94], ["2026-09", 234581.32],
  ["2026-10", 238389.46],
];

const OUT_2026: Record<LojaMeta, Partial<Record<IndicadorId, number>>> = {
  CGR: { TSI: 93.5, PASSAGENS: 621, FATURAMENTO: 580000,
         PNEU: 12, OLEO_10W30: 1255, OLEO_SCOOTER: 48, OLEO_20W50: 770, KIT_LUB: 24, BATERIA: 24 },
  TEM: { TSI: 93.5, PASSAGENS: 506, FATURAMENTO: 111000,
         PV: 42000, OLEO_10W30: 624, OLEO_SCOOTER: 24, KIT_LUB: 24, BATERIA: 9 },
};

export const METAS_PADRAO: Meta[] = [
  ...PV_CGR.map(([mes, meta]) => ({ mes, loja: "CGR" as const, indicador: "PV" as const, meta })),
  ...(Object.entries(OUT_2026) as [LojaMeta, Partial<Record<IndicadorId, number>>][]).flatMap(([loja, m]) =>
    (Object.entries(m) as [IndicadorId, number][]).map(([indicador, meta]) => ({ mes: "2026-10", loja, indicador, meta }))
  ),
];
