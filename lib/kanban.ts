import { dateCG, getAgendamentos, getApontamentosRaw, getOrdensServicoRaw, type RawRow } from "@/lib/microwork";

export type Coluna = "agendado" | "aguardando" | "em_servico" | "pausa" | "preparacao" | "entregue";

export interface KanbanCard {
  id:        string;
  coluna:    Coluna;
  loja:      string;
  numeroOS:  string;
  placa:     string;
  cliente:   string;
  modelo:    string;
  tipoOS:    string;
  tecnico:   string;
  servicos:  string[];
  motivo:    string;
  desde:     string;
  hora:      string;
}

const JANELA_DIAS = 60;
const EM_SERVICO_MAX_DIAS = 3;

const s = (v: unknown) => (v == null ? "" : String(v)).trim();
const up = (v: unknown) => s(v).toUpperCase();
const osNum = (v: unknown) => s(v).replace(/\D/g, "");

export async function montarKanban(): Promise<KanbanCard[]> {
  const hoje   = dateCG();
  const inicio = dateCG(-JANELA_DIAS);
  const limiteServico = dateCG(-EM_SERVICO_MAX_DIAS);

  const [aponts, oss, agenda] = await Promise.all([
    getApontamentosRaw(inicio, hoje),
    getOrdensServicoRaw(inicio, hoje),
    getAgendamentos(),
  ]);

  const osPorNumero = new Map<string, RawRow>();
  for (const o of oss) osPorNumero.set(`${up(o.empresa)}-${osNum(o.numeroos)}`, o);

  const linhasPorOS = new Map<string, RawRow[]>();
  for (const a of aponts) {
    const n = osNum(a.numero);
    if (!n || n === "0") continue;
    const k = `${up(a.descricaoreduzida)}-${n}`;
    const arr = linhasPorOS.get(k) ?? [];
    arr.push(a);
    linhasPorOS.set(k, arr);
  }

  const cards: KanbanCard[] = [];

  for (const [k, linhas] of linhasPorOS) {
    const n = k.split("-")[1];
    linhas.sort((x, y) => s(x.datainicialapontamento).localeCompare(s(y.datainicialapontamento)));
    const ultima = linhas[linhas.length - 1];
    const os = osPorNumero.get(k);

    // Situação atual de cada serviço = sua linha mais recente.
    const porServico = new Map<string, RawRow>();
    for (const l of linhas) porServico.set(s(l.servico), l);
    const atuais = [...porServico.values()];

    const fechamento = s(linhas.find(l => s(l.datafechamento))?.datafechamento).slice(0, 10);
    const aberto = atuais.find(l => up(l.situacaoapontamento) === "ABERTO");
    const pausa  = atuais.find(l => up(l.situacaoapontamentoitem) === "PAUSA");

    let coluna: Coluna;
    let ref = ultima;
    if (fechamento || up(os?.ospassagemsituacao) === "FINALIZADA") {
      if (fechamento !== hoje) continue;
      coluna = "entregue";
    } else if (aberto) {
      if (s(aberto.datainicialapontamento).slice(0, 10) < limiteServico) continue;
      coluna = "em_servico"; ref = aberto;
    } else if (pausa) {
      coluna = "pausa"; ref = pausa;
    } else {
      coluna = "preparacao";
    }

    cards.push({
      id: `os-${k}`,
      coluna,
      loja:     up(ultima.descricaoreduzida) || up(os?.empresa),
      numeroOS: n,
      placa:    s(ultima.placa) || s(os?.placa),
      cliente:  s(ultima.pessoa) || s(os?.proprietario),
      modelo:   s(os?.modelo),
      tipoOS:   s(ultima.ostipo),
      tecnico:  s(ref.pessoatecnico),
      servicos: [...porServico.keys()].filter(Boolean),
      motivo:   coluna === "pausa" ? s(ref.motivopausaapontamento) : "",
      desde:    coluna === "entregue" ? fechamento : s(ref.datainicialapontamento),
      hora:     coluna === "em_servico" ? s(ref.horainicial) : s(ref.horafinal || ref.horainicial),
    });
  }

  for (const [k, o] of osPorNumero) {
    const n = k.split("-")[1];
    if (linhasPorOS.has(k) || up(o.ospassagemsituacao) === "FINALIZADA") continue;
    cards.push({
      id: `os-${k}`,
      coluna:   "aguardando",
      loja:     up(o.empresa),
      numeroOS: n,
      placa:    s(o.placa),
      cliente:  s(o.proprietario),
      modelo:   s(o.modelo),
      tipoOS:   "",
      tecnico:  "",
      servicos: [],
      motivo:   "",
      desde:    s(o.dataemissao),
      hora:     "",
    });
  }

  agenda.forEach((ag, i) => {
    const data = (ag.DataRecepcao || ag.InicioOficina || ag.DataOficina || "").slice(0, 10);
    if (data !== hoje || !up(ag.Situacao).includes("ABERTO")) return;
    cards.push({
      id: `ag-${ag.CodigoAgendamento || i}`,
      coluna:   "agendado",
      loja:     up(ag.Empresa),
      numeroOS: "",
      placa:    ag.Placa,
      cliente:  ag.Proprietario,
      modelo:   ag.Modelo,
      tipoOS:   ag.TipoOS,
      tecnico:  ag.Consultor,
      servicos: [],
      motivo:   "",
      desde:    data,
      hora:     (ag.HoraInicioRecepcao ?? "").slice(0, 5),
    });
  });

  return cards;
}
