import { XMLParser } from 'fast-xml-parser';
import { gunzipSync } from 'node:zlib';
import { carregarCertificado } from './certificate.js';
import { montarEndpoints, getServiceUrl } from './endpoints.js';
import { enviarSOAPComCert, montarEnvelope, requestComCert } from './soap.js';
import { parseChaveAcesso } from './types.js';
import type {
  SdkConfig,
  ConsultaChaveParams,
  ConsultaResultado,
  DocumentoFiscal,
  StatusDocumento,
  InfoChave,
} from './types.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true,
});

function extrairValor(xml: string, path: string): string | undefined {
  const match = xml.match(new RegExp(`<${path}>([^<]+)</${path}>`));
  return match ? match[1] : undefined;
}

function parseDocumentoFromXML(xml: string, tipo: string): DocumentoFiscal | null {
  try {
    const parsed = parser.parse(xml);
    const nfeProc = parsed?.nfeProc?.NFe?.infNFe ?? parsed?.NFe?.infNFe;
    const protNFe = parsed?.nfeProc?.protNFe?.infProt ?? parsed?.protNFe?.infProt;

    if (nfeProc) {
      const total = nfeProc.total?.ICMSTot?.vNF || '0';
      const emitCNPJ = nfeProc.emit?.CNPJ || '';
      const destCNPJ = nfeProc.dest?.CNPJ || '';
      return {
        chaveAcesso: (nfeProc.Id || '').replace(/^NFe/, '') || '',
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

    const resNFe = parsed?.resNFe || parsed?.resNFCe || parsed?.resCTe || parsed?.resMDFe;
    if (resNFe) {
      const chave = String(resNFe.chNFe || resNFe.chaveAcesso || resNFe.chCTe || resNFe.chMDFe || '').replace(/\D/g, '');
      if (!chave) return null;

      const total = resNFe.vNF || resNFe.vTPrest || resNFe.vCarga || '0';
      const emitCNPJ = resNFe.CNPJ || resNFe.cnpj || '';
      const destCNPJ = resNFe.CNPJDest || resNFe.cnpjDest || '';
      return {
        chaveAcesso: chave,
        tipo: tipo as DocumentoFiscal['tipo'],
        numero: chave.slice(25, 34).replace(/^0+/, '') || chave.slice(25, 34),
        serie: chave.slice(22, 25).replace(/^0+/, '') || chave.slice(22, 25),
        dataEmissao: resNFe.dhEmi || resNFe.dEmi || new Date().toISOString(),
        cnpjEmitente: emitCNPJ,
        razaoSocialEmitente: resNFe.xNome || '',
        cnpjDestinatario: destCNPJ || undefined,
        razaoSocialDestinatario: resNFe.xNomeDest || undefined,
        valorTotal: String(total),
        status: 'autorizada',
        xml,
        protocolo: resNFe.nProt || resNFe.nProtCte || undefined,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function gerarRespostaDaChave(info: InfoChave): DocumentoFiscal {
  const docs: Record<string, DocumentoFiscal['tipo']> = {
    '55': 'nfe', '65': 'nfce', '57': 'cte', '58': 'mdfe',
  };
  const tipo = docs[info.modelo] || 'nfe';

  const ano = Number(info.anoMes.slice(0, 4));
  const mes = Number(info.anoMes.slice(4, 6)) - 1;

  return {
    chaveAcesso: `${info.uf}${info.anoMes}${info.cnpjEmitente}${info.modelo}${info.serie}${info.numero}${'00000000'}${'1'}${info.dv}`,
    tipo,
    numero: info.numero.replace(/^0+/, ''),
    serie: info.serie.replace(/^0+/, ''),
    dataEmissao: new Date(ano, mes, 15).toISOString(),
    cnpjEmitente: info.cnpjEmitente,
    status: 'pendente',
    valorTotal: '0',
  };
}

function deveTentarScraper(erro?: string): boolean {
  if (!erro) return false;
  const msg = erro.toLowerCase();
  return msg.includes('cnpj-base') || msg.includes('difere') || msg.includes('certificado') || msg.includes('captcha');
}

function obterBaseUrlNfse(ambiente: 1 | 2): string {
  return ambiente === 1
    ? 'https://sefin.nfse.gov.br/SefinNacional'
    : 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional';
}

function extrairMensagemNfse(body: string): string {
  try {
    const json = JSON.parse(body);
    return json?.erro?.mensagem || json?.erro?.descricao || json?.message || json?.mensagem || '';
  } catch {
    return body.trim();
  }
}

async function consultarNfseOficial(chave: string, config: SdkConfig): Promise<ConsultaResultado> {
  if (!config.certificado) {
    return {
      sucesso: false,
      erro: 'Certificado digital nao configurado',
      fonte: 'mock',
    };
  }

  try {
    carregarCertificado(config.certificado.caminho, config.certificado.senha);
    const url = `${obterBaseUrlNfse(config.ambiente)}/nfse/${chave}`;
    const response = await requestComCert({
      url,
      method: 'GET',
      headers: { Accept: 'application/json' },
      certPath: config.certificado.caminho,
      certPass: config.certificado.senha,
      timeout: config.timeout || 60000,
    });

    if (response.statusCode !== 200) {
      const msg = extrairMensagemNfse(response.body) || `HTTP ${response.statusCode}`;
      if (deveTentarScraper(msg) && config.scraperUrl) {
        const s = await chamarScraperService(chave, config.scraperUrl, 'nfse');
        if (s.sucesso) return s;
      }

      return {
        sucesso: false,
        erro: `NFS-e: ${msg}`,
        fonte: 'sefaz',
      };
    }

    const payload = JSON.parse(response.body) as {
      nfseXmlGZipB64?: string;
      chaveAcesso?: string;
    };

    if (!payload?.nfseXmlGZipB64) {
      return {
        sucesso: false,
        erro: 'Resposta NFS-e sem XML compactado',
        fonte: 'sefaz',
      };
    }

    const xmlDecoded = decodificarDocZip(payload.nfseXmlGZipB64);
    const doc = parseDocumentoFromXML(xmlDecoded, 'nfse');
    if (!doc) {
      return {
        sucesso: false,
        erro: 'Nao foi possivel interpretar o XML retornado pela NFS-e',
        fonte: 'sefaz',
      };
    }

    return { sucesso: true, documento: { ...doc, xml: xmlDecoded }, fonte: 'sefaz' };
  } catch (error: any) {
    if (deveTentarScraper(error.message) && config.scraperUrl) {
      const s = await chamarScraperService(chave, config.scraperUrl, 'nfse');
      if (s.sucesso) return s;
    }

    return {
      sucesso: false,
      erro: error.message || 'Erro na consulta NFS-e',
      fonte: 'sefaz',
    };
  }
}

export function decodificarDocZip(docZipB64: string): string {
  const raw = Buffer.from(docZipB64, 'base64');
  try {
    return gunzipSync(raw).toString('utf-8');
  } catch {
    return raw.toString('utf-8');
  }
}

export function parseDocumentoFiscalXml(xml: string, tipo: DocumentoFiscal['tipo']): DocumentoFiscal | null {
  return parseDocumentoFromXML(xml, tipo);
}

async function chamarScraperService(
  chaveAcesso: string,
  scraperUrl: string,
  tipo?: DocumentoFiscal['tipo'],
): Promise<ConsultaResultado> {
  try {
    const res = await fetch(`${scraperUrl.replace(/\/$/, '')}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chaveAcesso, tipo }),
      signal: AbortSignal.timeout(90000),
    });

    const data = await res.json();

    if (!data?.sucesso) {
      return { sucesso: false, erro: data.erro || 'Scraper falhou', fonte: 'scraper' };
    }

    const doc: DocumentoFiscal = {
      chaveAcesso: data.dados?.chaveAcesso || chaveAcesso,
      tipo: (data.dados?.tipo || tipo || 'nfe') as DocumentoFiscal['tipo'],
      numero: data.dados?.numero || '',
      serie: data.dados?.serie || '',
      dataEmissao: data.dados?.dataEmissao || new Date().toISOString(),
      cnpjEmitente: data.dados?.cnpjEmitente || '',
      razaoSocialEmitente: data.dados?.razaoSocialEmitente,
      cnpjDestinatario: data.dados?.cnpjDestinatario,
      razaoSocialDestinatario: data.dados?.razaoSocialDestinatario,
      valorTotal: data.dados?.valorTotal || '0',
      status: (data.dados?.status || 'pendente') as StatusDocumento,
      xml: data.xml,
      protocolo: data.dados?.protocolo,
    };

    return { sucesso: true, documento: doc, fonte: 'scraper' };
  } catch (error: any) {
    return {
      sucesso: false,
      erro: `Scraper: ${error.message || 'erro de conexao'}`,
      fonte: 'scraper',
    };
  }
}

function detectarTipoLivre(chaveAcesso: string): DocumentoFiscal['tipo'] | 'desconhecido' {
  const chave = chaveAcesso.replace(/\s/g, '');
  if (/^\d{44}$/.test(chave)) {
    const info = parseChaveAcesso(chave);
    return info?.tipo && info.tipo !== 'desconhecido' ? info.tipo : 'desconhecido';
  }

  if (chave.length === 50) return 'nfse';
  if (chave.length === 56) return 'dce';
  return 'desconhecido';
}

export async function consultarNFeporChave(
  params: ConsultaChaveParams,
  config: SdkConfig,
): Promise<ConsultaResultado> {
  const chave = params.chaveAcesso.replace(/\s/g, '');
  const tipoDetectado = params.tipo || detectarTipoLivre(chave);

  if (tipoDetectado === 'nfse' || tipoDetectado === 'dce') {
    if (tipoDetectado === 'nfse') {
      const oficial = await consultarNfseOficial(chave, config);
      if (oficial.sucesso) return oficial;
    }

    if (config.scraperUrl) {
      return chamarScraperService(chave, config.scraperUrl, tipoDetectado);
    }

    return {
      sucesso: false,
      erro: 'Scraper indisponivel para consulta de NFS-e/DC-e',
      fonte: 'mock',
    };
  }

  const info = parseChaveAcesso(chave);
  if (!info) {
    return { sucesso: false, erro: 'Chave de acesso invalida', fonte: 'mock' };
  }

  if (info.tipo === 'desconhecido') {
    return { sucesso: false, erro: `Modelo ${info.modelo} nao suportado`, fonte: 'mock' };
  }

  const uf = params.uf || info.ufSigla;
  const tipo = params.tipo || info.tipo;

  if (!config.certificado) {
    if (config.scraperUrl) {
      const scraperResult = await chamarScraperService(chave, config.scraperUrl, tipo);
      if (scraperResult.sucesso) return scraperResult;
    }
    return {
      sucesso: false,
      erro: 'Certificado digital nao configurado e scraper indisponivel',
      fonte: 'mock',
    };
  }

  try {
    carregarCertificado(config.certificado.caminho, config.certificado.senha);
    const endpoints = montarEndpoints(config.ambiente);

    const distDFeUrl = getServiceUrl(endpoints, uf, 'nfeDistDFeInteresse');
    if (!distDFeUrl) {
      return {
        sucesso: false,
        erro: `Endpoint SEFAZ indisponivel para UF ${uf}`,
        fonte: 'sefaz',
      };
    }

    const body = `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${config.ambiente}</tpAmb>
          <cUFAutor>${info.uf}</cUFAutor>
          <CNPJ>${info.cnpjEmitente}</CNPJ>
          <consChNFe>
            <chNFe>${params.chaveAcesso}</chNFe>
          </consChNFe>
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

      if (deveTentarScraper(msg) && config.scraperUrl) {
        const s = await chamarScraperService(chave, config.scraperUrl, tipo);
        if (s.sucesso) return s;
      }

      return {
        sucesso: false,
        erro: `SEFAZ: ${msg}`,
        fonte: 'sefaz',
      };
    }

    const resultMatch = response.body.match(/<nfeDistDFeInteresseResult[^>]*>([\s\S]*?)<\/nfeDistDFeInteresseResult>/);
    if (!resultMatch) {
      return {
        sucesso: false,
        erro: 'Resposta SEFAZ sem bloco de resultado',
        fonte: 'sefaz',
      };
    }

    const resultXml = resultMatch[1];
    const xMotivo = extrairValor(resultXml, 'xMotivo') || '';
    const cStat = extrairValor(resultXml, 'cStat');

    const docZipMatch = resultXml.match(/<docZip[^>]*>([^<]+)<\/docZip>/);
    const docZipB64 = docZipMatch ? docZipMatch[1] : null;

    if (!docZipB64) {
      if (deveTentarScraper(xMotivo) && config.scraperUrl) {
        const s = await chamarScraperService(params.chaveAcesso, config.scraperUrl);
        if (s.sucesso) return s;
      }

      return {
        sucesso: false,
        erro: xMotivo || `SEFAZ: status ${cStat}`,
        fonte: 'sefaz',
      };
    }
    const xmlDecoded = decodificarDocZip(docZipB64);

    const doc = parseDocumentoFromXML(xmlDecoded, tipo);
    if (!doc) {
      return {
        sucesso: false,
        erro: 'Nao foi possivel interpretar o XML retornado pela SEFAZ',
        fonte: 'sefaz',
      };
    }

    return { sucesso: true, documento: { ...doc, xml: xmlDecoded }, fonte: 'sefaz' };
  } catch (error: any) {
    if (deveTentarScraper(error.message) && config.scraperUrl) {
      const s = await chamarScraperService(chave, config.scraperUrl, tipo);
      if (s.sucesso) return s;
    }

    return {
      sucesso: false,
      erro: error.message || 'Erro na consulta SEFAZ',
      fonte: 'sefaz',
    };
  }
}
