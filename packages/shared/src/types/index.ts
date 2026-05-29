export type TipoDocumento = 'nfe' | 'nfce' | 'nfse' | 'cte' | 'mdfe' | 'dce';

export type StatusDocumento =
  | 'autorizada'
  | 'cancelada'
  | 'denegada'
  | 'inutilizada'
  | 'pendente'
  | 'processando'
  | 'erro';

export type AmbienteSEFAZ = 1 | 2; // 1=Produção, 2=Homologação

export interface DocumentoFiscal {
  id: string;
  chaveAcesso: string;
  tipo: TipoDocumento;
  numero: string;
  serie: string;
  dataEmissao: string;
  cnpjEmitente: string;
  razaoSocialEmitente?: string;
  cnpjDestinatario?: string;
  razaoSocialDestinatario?: string;
  valorTotal: number;
  status: StatusDocumento;
  xmlUrl?: string;
  danfeUrl?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ConsultaChaveRequest {
  chaveAcesso: string;
}

export interface ConsultaCNPJRequest {
  cnpj: string;
  tipo?: 'emitidas' | 'recebidas' | 'todas';
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
  limite?: number;
}

export interface ConsultaResponse {
  sucesso: boolean;
  dados?: DocumentoFiscal;
  erro?: string;
}

export interface ListaDocumentosResponse {
  sucesso: boolean;
  dados?: {
    documentos: DocumentoFiscal[];
    total: number;
    pagina: number;
    limite: number;
    paginas: number;
  };
  erro?: string;
}

export interface StatusSEFAZResponse {
  uf: string;
  status: 'online' | 'offline' | 'manutencao';
  ultimoCheck: string;
  latencia?: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  versao: string;
  uptime: number;
  timestamp: string;
}
