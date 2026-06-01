export type Ambiente = 1 | 2;

export type TipoDocumento = 'nfe' | 'nfce' | 'nfse' | 'cte' | 'mdfe' | 'bpe' | 'cteos' | 'dce';

export type Fonte = 'sefaz' | 'cache' | 'mock' | 'scraper';

export type StatusDocumento =
  | 'autorizada'
  | 'cancelada'
  | 'denegada'
  | 'inutilizada'
  | 'pendente'
  | 'processando'
  | 'erro';

export interface SefazEndpoint {
  uf: string;
  sigla: string;
  servicos: Partial<Record<string, string>>;
}

export interface CertificadoConfig {
  caminho: string;
  senha: string;
}

export interface SdkConfig {
  ambiente: Ambiente;
  certificado?: CertificadoConfig;
  ufPadrao?: string;
  timeout?: number;
  scraperUrl?: string;
  anticaptchaKey?: string;
}

export interface ConsultaChaveParams {
  chaveAcesso: string;
  uf?: string;
  tipo?: TipoDocumento;
}

export interface ConsultaCNPJParams {
  cnpj: string;
  uf?: string;
  tipo?: TipoDocumento;
  dataInicio?: string;
  dataFim?: string;
}

export interface DocumentoFiscal {
  chaveAcesso: string;
  tipo: TipoDocumento;
  numero: string;
  serie: string;
  dataEmissao: string;
  cnpjEmitente: string;
  razaoSocialEmitente?: string;
  cnpjDestinatario?: string;
  razaoSocialDestinatario?: string;
  valorTotal: string;
  status: StatusDocumento;
  xml?: string;
  protocolo?: string;
}

export interface ConsultaResultado {
  sucesso: boolean;
  documento?: DocumentoFiscal;
  erro?: string;
  fonte: Fonte;
}

export interface ConsultaComCache extends ConsultaChaveParams {
  cacheKey?: string;
  forcarScraper?: boolean;
}

export interface DistribuicaoResultado {
  sucesso: boolean;
  documentos: DocumentoFiscal[];
  ultraimoNSU?: string;
  erro?: string;
  fonte: Fonte;
}

export interface InfoChave {
  uf: string;
  ufSigla: string;
  anoMes: string;
  cnpjEmitente: string;
  modelo: string;
  serie: string;
  numero: string;
  tipo: TipoDocumento | 'desconhecido';
  dv: string;
}

const MODELO_PARA_TIPO: Record<string, TipoDocumento> = {
  '55': 'nfe',
  '65': 'nfce',
  '57': 'cte',
  '58': 'mdfe',
  '63': 'bpe',
  '67': 'cteos',
};

export function parseChaveAcesso(chave: string): InfoChave | null {
  const nums = chave.replace(/\D/g, '');
  if (nums.length !== 44) return null;

  const modelo = nums.slice(20, 22);
  const tipo = MODELO_PARA_TIPO[modelo] || 'desconhecido';

  const codigosUf: Record<string, string> = {
    '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
    '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
    '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
    '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
    '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
    '52': 'GO', '53': 'DF',
  };

  return {
    uf: nums.slice(0, 2),
    ufSigla: codigosUf[nums.slice(0, 2)] || 'XX',
    anoMes: nums.slice(2, 6),
    cnpjEmitente: nums.slice(6, 20),
    modelo,
    serie: nums.slice(22, 25),
    numero: nums.slice(25, 34),
    tipo,
    dv: nums.slice(43, 44),
  };
}
