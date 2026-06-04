import type { SefazEndpoint, Ambiente } from './types.js';

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
const CTE_SVRS_PRODUCAO = 'https://cte.svrs.rs.gov.br';
const CTE_SVRS_HOMOLOGACAO = 'https://cte-homologacao.svrs.rs.gov.br';
const SVAN_PRODUCAO = 'https://www.svan.fazenda.gov.br';
const SVAN_HOMOLOGACAO = 'https://homologacao.svan.fazenda.gov.br';
const SVC_PRODUCAO = 'https://www.svc.fazenda.gov.br';
const SVC_HOMOLOGACAO = 'https://homologacao.svc.fazenda.gov.br';
const NFCE_PRODUCAO = 'https://nfce.sefazeletronica.gov.br';
const NFCE_HOMOLOGACAO = 'https://nfce.sefazeletronica.gov.br';
const BPE_PR_PRODUCAO = 'https://bpe.fazenda.pr.gov.br/bpe';
const BPE_PR_HOMOLOGACAO = 'https://homologacao.bpe.fazenda.pr.gov.br/bpe';
const BPE_SVRS_PRODUCAO = 'https://bpe.svrs.rs.gov.br/ws';
const BPE_SVRS_HOMOLOGACAO = 'https://bpe-homologacao.svrs.rs.gov.br/ws';
const BPE_SP_PRODUCAO = 'https://bpe.fazenda.sp.gov.br/BPeWeb/services';
const BPE_SP_HOMOLOGACAO = 'https://homologacao.bpe.fazenda.sp.gov.br/BPeWeb/services';
const BPE_MG_PRODUCAO = 'https://bpe.fazenda.mg.gov.br/bpe/services';
const BPE_MG_HOMOLOGACAO = 'https://hbpe.fazenda.mg.gov.br/bpe/services';
const BPE_MS_PRODUCAO = 'https://bpe.fazenda.ms.gov.br/ws';
const BPE_MS_HOMOLOGACAO = 'https://homologacao.bpe.ms.gov.br/ws';
const BPE_MT_PRODUCAO = 'https://www.sefaz.mt.gov.br/bpe-ws/services';
const BPE_MT_HOMOLOGACAO = 'https://homologacao.sefaz.mt.gov.br/bpe-ws/services';
const DCE_PR_PRODUCAO = 'https://dce.fazenda.pr.gov.br/dce';
const DCE_PR_HOMOLOGACAO = 'https://homologacao.dce.fazenda.pr.gov.br/dce';

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

function bpeBase(sigla: string, amb: Ambiente): string {
  if (sigla === 'PR') return amb === 1 ? BPE_PR_PRODUCAO : BPE_PR_HOMOLOGACAO;
  if (sigla === 'SP') return amb === 1 ? BPE_SP_PRODUCAO : BPE_SP_HOMOLOGACAO;
  if (sigla === 'MG') return amb === 1 ? BPE_MG_PRODUCAO : BPE_MG_HOMOLOGACAO;
  if (sigla === 'MS') return amb === 1 ? BPE_MS_PRODUCAO : BPE_MS_HOMOLOGACAO;
  if (sigla === 'MT') return amb === 1 ? BPE_MT_PRODUCAO : BPE_MT_HOMOLOGACAO;
  return amb === 1 ? BPE_SVRS_PRODUCAO : BPE_SVRS_HOMOLOGACAO;
}

function dceBase(amb: Ambiente): string {
  return amb === 1 ? DCE_PR_PRODUCAO : DCE_PR_HOMOLOGACAO;
}

function mdfeConsultaBase(amb: Ambiente): string {
  return amb === 1
    ? 'https://mdfe.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx'
    : 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx';
}

function cteConsultaBase(sigla: string, amb: Ambiente): string {
  if (sigla === 'PR') return 'https://cte.fazenda.pr.gov.br/cte4/CTeConsultaV4';
  if (sigla === 'SP') return amb === 1 ? 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeConsultaV4.asmx' : 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeConsultaV4.asmx';
  if (sigla === 'MG') return amb === 1 ? 'https://cte.fazenda.mg.gov.br/cte/services/CTeConsultaV4' : 'https://cte.fazenda.mg.gov.br/cte/services/CTeConsultaV4';
  if (sigla === 'MS') return amb === 1 ? 'https://producao.cte.ms.gov.br/ws/CTeConsultaV4' : 'https://homologacao.cte.ms.gov.br/ws/CTeConsultaV4';
  if (sigla === 'MT') return amb === 1 ? 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeConsultaV4' : 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeConsultaV4';
  return amb === 1 ? `${CTE_SVRS_PRODUCAO}/ws/CTeConsultaV4/CTeConsultaV4.asmx` : `${CTE_SVRS_HOMOLOGACAO}/ws/CTeConsultaV4/CTeConsultaV4.asmx`;
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
      ? 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
      : 'https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
    const distDFeAction = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';

    const nfceServ = amb === 1
      ? `https://nfce.sefazeletronica.gov.br/nfce-ws/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
      : `https://nfce.sefazeletronica.gov.br/nfce-ws/hom/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`;

    const bpeServ = bpeBase(sigla, amb);
    const dceServ = dceBase(amb);

    return {
      ...ep,
      servicos: {
        nfeDistDFeInteresse: distDFe,
        nfeConsultaProtocolo: `${baseNfe}/NFeWS/ConsultaProtocolo.asmx`,
        nfeDownloadNF: `${baseNfe}/NFeWS/DownloadNF.asmx`,
        nfceDistDFeInteresse: nfceServ,
        cteConsultaProtocolo: `${CTE_SVRS_PRODUCAO}/ws/CTeWS/ConsultaProtocolo.asmx`,
        cteDistDFeInteresse: `${amb === 1 ? CTE_SVRS_PRODUCAO : CTE_SVRS_HOMOLOGACAO}/ws/CTeWS/DistribuicaoDFe.asmx`,
        cteConsulta: cteConsultaBase(sigla, amb),
        cteRecepcaoOS: `${amb === 1 ? CTE_SVRS_PRODUCAO : CTE_SVRS_HOMOLOGACAO}/ws/CTeWS/RecepcaoOS.asmx`,
        cteStatusServico: `${amb === 1 ? CTE_SVRS_PRODUCAO : CTE_SVRS_HOMOLOGACAO}/ws/CTeWS/StatusServico.asmx`,
        mdfeConsultaProtocolo: `${svrs(amb)}/MDFeWS/ConsultaProtocolo.asmx`,
        mdfeDistDFeInteresse: `${svrs(amb)}/MDFeWS/DistribuicaoDFe.asmx`,
        mdfeConsulta: mdfeConsultaBase(amb),
        bpeConsulta: `${bpeServ}/BPeConsulta`,
        bpeStatusServico: `${bpeServ}/BPeStatusServico`,
        bpeRecepcaoEvento: `${bpeServ}/BPeRecepcaoEvento`,
        cteosConsulta: cteConsultaBase(sigla, amb),
        cteosRecepcaoOS: `${amb === 1 ? CTE_SVRS_PRODUCAO : CTE_SVRS_HOMOLOGACAO}/ws/CTeWS/RecepcaoOS.asmx`,
        cteosStatusServico: `${amb === 1 ? CTE_SVRS_PRODUCAO : CTE_SVRS_HOMOLOGACAO}/ws/CTeWS/StatusServico.asmx`,
        dceConsulta: `${dceServ}/DCeConsulta`,
        dceStatusServico: `${dceServ}/DCeStatusServico`,
        dceRecepcaoEvento: `${dceServ}/DCeRecepcaoEvento`,
      },
    };
  });
}

export function getServiceUrl(endpoints: SefazEndpoint[], siglaUf: string, servico: string): string | null {
  const ep = endpoints.find((e) => e.sigla === siglaUf.toUpperCase());
  if (!ep) return null;
  return ep.servicos[servico] || null;
}
