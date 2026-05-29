import { XMLParser } from 'fast-xml-parser';
import { carregarCertificado } from './certificate';
import { montarEndpoints, getServiceUrl } from './endpoints';
import { enviarSOAPComCert, montarEnvelope } from './soap';
import { parseChaveAcesso } from './types';
import type {
  SdkConfig,
  ConsultaChaveParams,
  ConsultaResultado,
  DocumentoFiscal,
  StatusDocumento,
  InfoChave,
} from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true,
});

function detectarStatus(xml: string): StatusDocumento {
  const match = xml.match(/<cStat>(\d+)<\/cStat>/);
  if (match) {
    const code = match[1];
    if (['100', '101', '102', '110', '150', '301'].includes(code)) return 'autorizada';
    if (['101', '151'].includes(code)) return 'cancelada';
    if (['110', '301'].includes(code)) return 'denegada';
    if (code === '135') return 'inutilizada';
    if (['103', '104', '105', '106', '107', '108', '109'].includes(code)) return 'processando';
    return 'pendente';
  }
  return 'pendente';
}

function extrairValor(xml: string, path: string): string | undefined {
  const match = xml.match(new RegExp(`<${path}>([^<]+)</${path}>`));
  return match ? match[1] : undefined;
}

function parseDocumentoFromXML(xml: string, tipo: string): DocumentoFiscal | null {
  try {
    const parsed = parser.parse(xml);
    const nfeProc = parsed?.nfeProc?.NFe?.infNFe;
    const protNFe = parsed?.protNFe?.infProt;

    if (nfeProc) {
      const total = nfeProc.total?.ICMSTot?.vNF || '0';
      const emitCNPJ = nfeProc.emit?.CNPJ || '';
      const destCNPJ = nfeProc.dest?.CNPJ || '';
      return {
        chaveAcesso: (nfeProc.Id || '').replace('NFe', '') || '',
        tipo: tipo as DocumentoFiscal['tipo'],
        numero: nfeProc.ide?.nNF || '',
        serie: nfeProc.ide?.serie || '',
        dataEmissao: nfeProc.ide?.dhEmi || '',
        cnpjEmitente: emitCNPJ,
        razaoSocialEmitente: nfeProc.emit?.xNome || '',
        cnpjDestinatario: destCNPJ || undefined,
        razaoSocialDestinatario: nfeProc.dest?.xNome || undefined,
        valorTotal: String(total),
        status: 'autorizada',
        xml,
        protocolo: protNFe?.nProt || undefined,
      };
    }

    return {
      chaveAcesso: extrairValor(xml, 'chNFe') || '',
      tipo: tipo as DocumentoFiscal['tipo'],
      numero: extrairValor(xml, 'nNF') || '',
      serie: extrairValor(xml, 'serie') || '',
      dataEmissao: extrairValor(xml, 'dhEmi') || extrairValor(xml, 'dhProc') || '',
      cnpjEmitente: extrairValor(xml, 'CNPJ') || '',
      status: detectarStatus(xml),
      valorTotal: extrairValor(xml, 'vNF') || '0',
      xml,
    };
  } catch {
    return null;
  }
}

export async function consultarNFeporChave(
  params: ConsultaChaveParams,
  config: SdkConfig,
): Promise<ConsultaResultado> {
  const info = parseChaveAcesso(params.chaveAcesso);
  if (!info) {
    return { sucesso: false, erro: 'Chave de acesso invalida', fonte: 'mock' };
  }

  if (info.tipo === 'desconhecido') {
    return { sucesso: false, erro: `Modelo ${info.modelo} nao suportado`, fonte: 'mock' };
  }

  const uf = params.uf || info.ufSigla;
  const tipo = params.tipo || info.tipo;

  if (!config.certificado) {
    return gerarMockPorChave(info);
  }

  try {
    const cert = carregarCertificado(config.certificado.caminho, config.certificado.senha);
    const endpoints = montarEndpoints(config.ambiente);

    const distDFeUrl = getServiceUrl(endpoints, uf, 'nfeDistDFeInteresse');
    if (!distDFeUrl) {
      return { sucesso: false, erro: `Endpoint nao encontrado para UF ${uf}`, fonte: 'mock' };
    }

    const body = `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${config.ambiente}</tpAmb>
          <cUFAutor>${info.uf}</cUFAutor>
          <CNPJ>${info.cnpjEmitente}</CNPJ>
          <chNFe>${params.chaveAcesso}</chNFe>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>`;

    const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';
    const envelope = montarEnvelope(body);

    const response = await enviarSOAPComCert(
      distDFeUrl, envelope, action,
      config.certificado.caminho, config.certificado.senha,
      config.timeout || 60000,
    );

    if (response.statusCode !== 200) {
      const fault = response.body.match(/<faultstring>([^<]+)<\/faultstring>/);
      const msg = fault ? fault[1] : `HTTP ${response.statusCode}`;
      return { sucesso: false, erro: `SEFAZ: ${msg}`, fonte: 'sefaz' };
    }

    const resultMatch = response.body.match(/<nfeDistDFeInteresseResult[^>]*>([\s\S]*?)<\/nfeDistDFeInteresseResult>/);
    if (!resultMatch) {
      return { sucesso: false, erro: 'Resposta inesperada da SEFAZ', fonte: 'sefaz' };
    }

    const resultXml = resultMatch[1];

    const docZipMatch = resultXml.match(/<docZip[^>]*>([^<]+)<\/docZip>/);
    const docZipB64 = docZipMatch ? docZipMatch[1] : null;

    const cStat = extrairValor(resultXml, 'cStat');
    const xMotivo = extrairValor(resultXml, 'xMotivo');

    if (!docZipB64) {
      return { sucesso: false, erro: xMotivo || `SEFAZ: status ${cStat}`, fonte: 'sefaz' };
    }

    const xmlDecoded = Buffer.from(docZipB64, 'base64').toString('utf-8');

    const doc = parseDocumentoFromXML(xmlDecoded, tipo);
    if (!doc) {
      return {
        sucesso: true,
        documento: {
          chaveAcesso: params.chaveAcesso,
          tipo: tipo as DocumentoFiscal['tipo'],
          numero: info.numero,
          serie: info.serie,
          dataEmissao: new Date().toISOString(),
          cnpjEmitente: info.cnpjEmitente,
          status: 'autorizada',
          valorTotal: '0',
          xml: xmlDecoded,
        },
        fonte: 'sefaz',
      };
    }

    return { sucesso: true, documento: doc, fonte: 'sefaz' };
  } catch (error: any) {
    return { sucesso: false, erro: error.message || 'Erro na consulta SEFAZ', fonte: 'sefaz' };
  }
}

function gerarMockPorChave(info: InfoChave): ConsultaResultado {
  const docs: Record<string, { tipo: DocumentoFiscal['tipo']; label: string }> = {
    '55': { tipo: 'nfe', label: 'NF-e' },
    '65': { tipo: 'nfce', label: 'NFC-e' },
    '57': { tipo: 'cte', label: 'CT-e' },
    '58': { tipo: 'mdfe', label: 'MDF-e' },
  };

  const docInfo = docs[info.modelo];
  if (!docInfo) {
    return { sucesso: false, erro: `Modelo ${info.modelo} nao suportado`, fonte: 'mock' };
  }

  return {
    sucesso: true,
    documento: {
      chaveAcesso: `${info.uf}${info.anoMes}${info.cnpjEmitente}${info.modelo}${info.serie}${info.numero}${info.dv}`,
      tipo: docInfo.tipo,
      numero: info.numero.replace(/^0+/, ''),
      serie: info.serie.replace(/^0+/, ''),
      dataEmissao: new Date(
        Number(info.anoMes.slice(0, 4)),
        Number(info.anoMes.slice(4, 6)) - 1,
        15,
        10,
        30,
        0,
      ).toISOString(),
      cnpjEmitente: info.cnpjEmitente,
      razaoSocialEmitente: `EMPRESA MOCK LTDA - ${info.ufSigla}`,
      cnpjDestinatario: '99888777000181',
      razaoSocialDestinatario: 'DESTINATARIO MOCK LTDA',
      valorTotal: String(Math.floor(Math.random() * 100000) / 100),
      status: 'autorizada',
      protocolo: `${info.uf}${new Date().getFullYear()}${String(Math.floor(Math.random() * 999999999)).padStart(9, '0')}`,
    },
    fonte: 'mock',
  };
}
