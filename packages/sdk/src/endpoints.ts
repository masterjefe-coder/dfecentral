import type { SefazEndpoint, Ambiente } from './types';

const AMBIENTE_SUFIXO: Record<Ambiente, string> = {
  1: '',
  2: 'homologacao',
};

const ENDPOINTS_PADRAO: SefazEndpoint[] = [
  { uf: '11', sigla: 'RO', servicos: {} },
  { uf: '12', sigla: 'AC', servicos: {} },
  { uf: '13', sigla: 'AM', servicos: {} },
  { uf: '14', sigla: 'RR', servicos: {} },
  { uf: '15', sigla: 'PA', servicos: {} },
  { uf: '16', sigla: 'AP', servicos: {} },
  { uf: '17', sigla: 'TO', servicos: {} },
  { uf: '21', sigla: 'MA', servicos: {} },
  { uf: '22', sigla: 'PI', servicos: {} },
  { uf: '23', sigla: 'CE', servicos: {} },
  { uf: '24', sigla: 'RN', servicos: {} },
  { uf: '25', sigla: 'PB', servicos: {} },
  { uf: '26', sigla: 'PE', servicos: {} },
  { uf: '27', sigla: 'AL', servicos: {} },
  { uf: '28', sigla: 'SE', servicos: {} },
  { uf: '29', sigla: 'BA', servicos: {} },
  { uf: '31', sigla: 'MG', servicos: {} },
  { uf: '32', sigla: 'ES', servicos: {} },
  { uf: '33', sigla: 'RJ', servicos: {} },
  { uf: '35', sigla: 'SP', servicos: {} },
  { uf: '41', sigla: 'PR', servicos: {} },
  { uf: '42', sigla: 'SC', servicos: {} },
  { uf: '43', sigla: 'RS', servicos: {} },
  { uf: '50', sigla: 'MS', servicos: {} },
  { uf: '51', sigla: 'MT', servicos: {} },
  { uf: '52', sigla: 'GO', servicos: {} },
  { uf: '53', sigla: 'DF', servicos: {} },
];

const SVRS_PRODUCAO = 'https://www.sefazvirtualrs.gov.br';
const SVRS_HOMOLOGACAO = 'https://homologacao.sefazvirtualrs.gov.br';
const SVAN_PRODUCAO = 'https://www.svan.fazenda.gov.br';
const SVAN_HOMOLOGACAO = 'https://homologacao.svan.fazenda.gov.br';
const SVC_PRODUCAO = 'https://www.svc.fazenda.gov.br';
const SVC_HOMOLOGACAO = 'https://homologacao.svc.fazenda.gov.br';
const NFCE_PRODUCAO = 'https://nfce.sefazeletronica.gov.br';
const NFCE_HOMOLOGACAO = 'https://nfce.sefazeletronica.gov.br';

const SUVs = [
  'AM', 'BA', 'CE', 'GO', 'MG', 'MS', 'MT', 'PE', 'PR', 'RS', 'SP',
];

function ufUsaSVRS(sigla: string): boolean {
  return !SUVs.includes(sigla) && sigla !== 'SC' && sigla !== 'RJ';
}

function ufUsaSUV(sigla: string): boolean {
  return SUVs.includes(sigla);
}

function ufUsaSVAN(sigla: string): boolean {
  return sigla === 'SC' || sigla === 'RJ';
}

function svrs(amb: Ambiente): string {
  return amb === 1 ? SVRS_PRODUCAO : SVRS_HOMOLOGACAO;
}

function svan(amb: Ambiente): string {
  return amb === 1 ? SVAN_PRODUCAO : SVAN_HOMOLOGACAO;
}

function svc(amb: Ambiente): string {
  return amb === 1 ? SVC_PRODUCAO : SVC_HOMOLOGACAO;
}

export function montarEndpoints(ambiente: Ambiente): SefazEndpoint[] {
  return ENDPOINTS_PADRAO.map((ep) => {
    const sigla = ep.sigla;
    const amb = ambiente;
    const sufixo = amb === 1 ? '' : 'homologacao';

    const baseNfe = ufUsaSUV(sigla)
      ? `https://${sigla.toLowerCase()}.sefaz.${sigla.toLowerCase()}.gov.br`
      : ufUsaSVAN(sigla)
        ? svan(amb)
        : svrs(amb);

    const distDFe = amb === 1
      ? 'https://www.sefazvirtualrs.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
      : 'https://hom.sefazvirtualrs.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

    const nfceServ = amb === 1
      ? `https://nfce.sefazeletronica.gov.br/nfce-ws/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
      : `https://nfce.sefazeletronica.gov.br/nfce-ws/hom/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`;

    return {
      ...ep,
      servicos: {
        nfeDistDFeInteresse: distDFe,
        nfeConsultaProtocolo: `${baseNfe}/NFeWS/ConsultaProtocolo.asmx`,
        nfeDownloadNF: `${baseNfe}/NFeWS/DownloadNF.asmx`,
        nfceDistDFeInteresse: nfceServ,
        cteConsultaProtocolo: `${svrs(amb)}/CTeWS/ConsultaProtocolo.asmx`,
        cteDistDFeInteresse: `${svrs(amb)}/CTeWS/DistribuicaoDFe.asmx`,
        mdfeConsultaProtocolo: `${svrs(amb)}/MDFeWS/ConsultaProtocolo.asmx`,
        mdfeDistDFeInteresse: `${svrs(amb)}/MDFeWS/DistribuicaoDFe.asmx`,
      },
    };
  });
}

export function getServiceUrl(endpoints: SefazEndpoint[], siglaUf: string, servico: string): string | null {
  const ep = endpoints.find((e) => e.sigla === siglaUf.toUpperCase());
  if (!ep) return null;
  return ep.servicos[servico] || null;
}
