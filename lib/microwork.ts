const BASE_URL = "https://microworkcloud.com.br/api/integracao/terceiro";

function getToken(): string {
  const t = process.env.MICROWORK_TOKEN;
  if (!t) throw new Error("MICROWORK_TOKEN não configurado");
  return t;
}

async function post<T>(body: object): Promise<T> {
  const res = await fetch(BASE_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Host":          "microworkcloud.com.br",
      "Authorization": `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Microwork error ${res.status}`);
  return res.json();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function sixMonthsLater(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

export type Empresa = "CGR" | "TEM" | "ALL";

const ALL_EMPRESAS = [1, 2, 13, 4, 8, 9, 10, 11, 12, 14, 15];

export interface Apontamento {
  Empresa:              string;
  Consultor:            string;
  DataInicio:           string;
  DataTermino:          string;
  Tecnico:              string;
  NumeroOS:             number | null;
  Placa:                string;
  Servico:              string;
  TempoServico:         string;
  TempoGasto:           string;
  TempoImprodutivo:     string;
  SituacaoApontamento:  string;
  SituacaoServicoItem:  string;
  [key: string]: unknown;
}

export interface Agendamento {
  Empresa:              string;
  Consultor:            string;
  Celular:              string;
  Chassi:               string;
  CodigoAgendamento:    number;
  CPFCNPJ:             string;
  DataOficina:          string;
  DataRecepcao:         string;
  HoraInicioRecepcao:   string;
  HoraTerminoRecepcao:  string;
  InicioOficina:        string;
  PrevisaoEntrega:      string;
  TipoOS:               string;
  Proprietario:         string;
  Modelo:               string;
  AgendadoPor:          string;
  Placa:                string;
  Situacao:             string;
  SolicitacaoCliente:   string;
  Tecnico:              string;
  TipoAgendamento:      string;
  Valor:                number;
  AgendamentoHoje:      boolean | number;
  AgendamentoDaqui1Dia: boolean | number;
  [key: string]: unknown;
}

export interface OrdemServico {
  Empresa:     string;
  Consultor:   string;
  DataEmissao: string;
  NumeroOS:    number;
  TipoOS:      string;
  Proprietario: string;
  Modelo:       string;
  Placa:        string;
  Situacao:     string;
  [key: string]: unknown;
}

export async function getApontamentos(): Promise<Apontamento[]> {
  const data = await post<unknown[]>({
    idrelatorioconfiguracao:       342,
    idrelatorioconsulta:           168,
    idrelatorioconfiguracaoleiaute: 342,
    idrelatoriousuarioleiaute:     909,
    ididioma:                      1,
    listaempresas:                 ALL_EMPRESAS,
    filtros: [
      "MotivoTempoPerdido=null",
      "ServicoDocumentoTipo=1,2",
      "PessoaFuncionarioTipoAtuacao=18,7,3,17,2",
      `Periodoinicial=${today()}`,
      `Periodofinal=${today()}`,
      "TipoApontamento=1,2,3",
      "SituacaoOS=null",
      "InserirDisponibilidade=False",
      "TipoOrdemServicoInterno=null",
      "Tecnico=null",
      "SituacaoServicoItem=null",
      "Cargo=null",
      "InserirParado=True",
      "OSTipoRecpecao=null",
      "OSDesconsiderarItensCortesia=False",
      "TipoOS=null",
      "Segmento=null",
      "NumeroOS=null",
      "SomenteItensEmCortesia=False",
    ].join(";"),
  });
  return (data ?? []) as Apontamento[];
}

export async function getAgendamentos(): Promise<Agendamento[]> {
  const data = await post<unknown[]>({
    idrelatorioconfiguracao:       282,
    idrelatorioconsulta:           135,
    idrelatorioconfiguracaoleiaute: 282,
    idrelatoriousuarioleiaute:     910,
    ididioma:                      1,
    listaempresas:                 ALL_EMPRESAS,
    filtros: [
      `DataInicio=${startOfMonth()}`,
      "Estado=null",
      "Consultor=null",
      "Tipoagendamento=1,4,3,2",
      "SomenteSemVinculo=False",
      "Segmento=null",
      `DataTermino=${sixMonthsLater()}`,
      "TipoOS=null",
      "Modelo=null",
      "Situacao=null",
      "AgendadoPor=",
    ].join(";"),
  });
  return (data ?? []) as Agendamento[];
}

export async function getOrdensServico(): Promise<OrdemServico[]> {
  const data = await post<unknown[]>({
    idrelatorioconfiguracao:       332,
    idrelatorioconsulta:           165,
    idrelatorioconfiguracaoleiaute: 332,
    idrelatoriousuarioleiaute:     911,
    ididioma:                      1,
    listaempresas:                 ALL_EMPRESAS,
    filtros: [
      "TipoOrdemServico=null",
      "TipoRecepcao=null",
      `UltimaPassagem=${tomorrow()}`,
      "Segmento=null",
      "TipoVeiculoOS=1,2",
      "TipoDeVeiculoMarca=null",
      "TipoDeVeiculoModelo=null",
      "TipoOrdemServicoInterno=null",
      "Modelo=null",
      "ModeloSistema=null",
      `DataEmissaoInicial=${today()}`,
      `DataEmissaoFinal=${today()}`,
    ].join(";"),
  });
  return (data ?? []) as OrdemServico[];
}
