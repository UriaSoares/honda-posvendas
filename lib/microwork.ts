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
  HorasPrevistas:       number;
  HorasApontadas:       number;
  [key: string]: unknown;
}

// "HH:MM:SS" → horas decimais. Vazio/inválido → 0.
function parseHoras(s: string | undefined | null): number {
  if (!s) return 0;
  const p = s.split(":").map(Number);
  if (p.length < 2 || p.some(isNaN)) return 0;
  return Math.round((p[0] + p[1] / 60 + (p[2] ?? 0) / 3600) * 100) / 100;
}

type Raw = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

function mapAgendamento(r: Raw): Agendamento {
  return {
    Empresa:              str(r.empresa),
    Consultor:            str(r.consultor),
    Celular:              str(r.telefonecelularformatado),
    Chassi:               str(r.chassi),
    CodigoAgendamento:    num(r.idoficinaagendamento),
    CPFCNPJ:              str(r.cpfoucnpj),
    DataOficina:          str(r.datainiciooficina),
    DataRecepcao:         str(r.datainiciorecepcao),
    HoraInicioRecepcao:   str(r.horainiciorecepcao),
    HoraTerminoRecepcao:  str(r.horaterminorecepcao),
    InicioOficina:        str(r.datahorainiciooficina),
    PrevisaoEntrega:      str(r.previsaoentrega),
    TipoOS:               str(r.tipoos),
    Proprietario:         str(r.proprietario),
    Modelo:               str(r.modelo),
    AgendadoPor:          str(r.usuariobaseagendamento),
    Placa:                str(r.placa),
    Situacao:             str(r.oficinaagendamentosituacao),
    SolicitacaoCliente:   str(r.solicitacaocliente),
    Tecnico:              str(r.tecnico),
    TipoAgendamento:      str(r.tipodeagendamento),
    Valor:                num(r.valor),
    AgendamentoHoje:      num(r.agendamento_hoje),
    AgendamentoDaqui1Dia: num(r.agendamento_1dia),
  };
}

function mapApontamento(r: Raw): Apontamento {
  return {
    Empresa:             str(r.descricaoreduzida), // empresa vem aqui
    Consultor:           "",
    DataInicio:          str(r.datainicialapontamento),
    DataTermino:         str(r.datafinalapontamento),
    Tecnico:             str(r.pessoatecnico),
    NumeroOS:            num(r.numero) || null,
    Placa:               str(r.placa),
    Servico:             str(r.servico),
    TempoServico:        str(r.temposervico),
    TempoGasto:          str(r.tempogasto),
    TempoImprodutivo:    str(r.tempoimprodutivo),
    SituacaoApontamento: str(r.situacaoapontamento),
    SituacaoServicoItem: str(r.situacaoapontamentoitem),
    HorasPrevistas:      parseHoras(str(r.temposervico)),
    HorasApontadas:      parseHoras(str(r.tempogasto)),
  };
}

function mapOS(r: Raw): OrdemServico {
  return {
    Empresa:      str(r.empresa),
    Consultor:    "",
    DataEmissao:  str(r.dataemissao),
    NumeroOS:     str(r.numeroos).replace(/[[\]]/g, ""),
    TipoOS:       "",
    Proprietario: str(r.proprietario),
    Modelo:       str(r.modelo),
    Placa:        str(r.placa),
    Situacao:     str(r.ospassagemsituacao),
    Chassi:       str(r.chassi),
    Quilometragem: num(r.quilometragem),
  };
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
  Empresa:      string;
  Consultor:    string;
  DataEmissao:  string;
  NumeroOS:     string;
  TipoOS:       string;
  Proprietario: string;
  Modelo:       string;
  Placa:        string;
  Situacao:     string;
  Chassi:       string;
  Quilometragem: number;
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
  return (Array.isArray(data) ? data : []).map((r) => mapApontamento(r as Raw));
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
  return (Array.isArray(data) ? data : []).map((r) => mapAgendamento(r as Raw));
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
  return (Array.isArray(data) ? data : []).map((r) => mapOS(r as Raw));
}
