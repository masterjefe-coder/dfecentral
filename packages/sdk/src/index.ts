export { carregarCertificado, montarChavePrivada } from './certificate.js';
export { enviarSOAP, enviarSOAPComCert, montarEnvelope, assinarSOAP } from './soap.js';
export { consultarNFeporChave } from './consulta.js';
export { montarEndpoints, getServiceUrl } from './endpoints.js';
export { parseChaveAcesso } from './types.js';
export type {
  Ambiente,
  TipoDocumento,
  StatusDocumento,
  SdkConfig,
  CertificadoConfig,
  ConsultaChaveParams,
  ConsultaCNPJParams,
  ConsultaResultado,
  ConsultaComCache,
  DistribuicaoResultado,
  DocumentoFiscal,
  InfoChave,
  SefazEndpoint,
  Fonte,
} from './types.js';
