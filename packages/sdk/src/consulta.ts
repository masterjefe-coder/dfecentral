import { XMLParser } from 'fast-xml-parser';
import { gunzipSync } from 'node:zlib';
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
  return msg.includes('cnpj-base') || msg.includes('difere') || msg.includes('certificado');
}

function decodificarDocZip(docZipB64: string): string {
  const raw = Buffer.from(docZipB64, 'base64');
  try {
    return gunzipSync(raw).toString('utf-8');
  } catch {
    return raw.toString('utf-8');
  }
}

async function chamarScraperService(
  chaveAcesso: string,
  scraperUrl: string,
): Promise<ConsultaResultado> {
  try {
    const res = await fetch(`${scraperUrl.replace(/\/$/, '')}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chaveAcesso }),
      signal: AbortSignal.timeout(90000),
    });

    const data = await res.json();

    if (!data?.sucesso) {
      return { sucesso: false, erro: data.erro || 'Scraper falhou', fonte: 'scraper' };
    }

    const doc: DocumentoFiscal = {
      chaveAcesso: data.dados?.chaveAcesso || chaveAcesso,
      tipo: (data.dados?.tipo || 'nfe') as DocumentoFiscal['tipo'],
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
    if (config.scraperUrl) {
      const scraperResult = await chamarScraperService(params.chaveAcesso, config.scraperUrl);
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
        const s = await chamarScraperService(params.chaveAcesso, config.scraperUrl);
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
      const s = await chamarScraperService(params.chaveAcesso, config.scraperUrl);
      if (s.sucesso) return s;
    }

    return {
      sucesso: false,
      erro: error.message || 'Erro na consulta SEFAZ',
      fonte: 'sefaz',
    };
  }
}
