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

function encontrarXmlAninhado(valor: unknown, visitados = new Set<unknown>()): string | null {
  if (!valor || typeof valor !== 'object' && typeof valor !== 'string') return null;
  if (visitados.has(valor)) return null;
  visitados.add(valor);

  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (texto.startsWith('<') && texto.includes('>') && texto.length > 80) {
      return texto;
    }
    return null;
  }

  if (Array.isArray(valor)) {
    for (const item of valor) {
      const xml = encontrarXmlAninhado(item, visitados);
      if (xml) return xml;
    }
    return null;
  }

  for (const entry of Object.values(valor as Record<string, unknown>)) {
    const xml = encontrarXmlAninhado(entry, visitados);
    if (xml) return xml;
  }

  return null;
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

    const procBPe = parsed?.procBPe?.BPe?.infBPe ?? parsed?.BPe?.infBPe;
    if (procBPe) {
      return {
        chaveAcesso: String(procBPe.Id || '').replace(/^BPe/i, '') || '',
        tipo: tipo as DocumentoFiscal['tipo'],
        numero: String(procBPe.ide?.nBP || procBPe.ide?.nDoc || '').replace(/^0+/, ''),
        serie: String(procBPe.ide?.serie || '').replace(/^0+/, ''),
        dataEmissao: procBPe.ide?.dhEmi || new Date().toISOString(),
        cnpjEmitente: procBPe.emit?.CNPJ || '',
        razaoSocialEmitente: procBPe.emit?.xNome || '',
        cnpjDestinatario: procBPe.dest?.CNPJ || undefined,
        razaoSocialDestinatario: procBPe.dest?.xNome || undefined,
        valorTotal: String(procBPe.total?.vBPe || procBPe.total?.vTtRec || procBPe.total?.vPago || '0'),
        status: 'autorizada',
        xml,
        protocolo: parsed?.procBPe?.protBPe?.infProt?.nProt || parsed?.protBPe?.infProt?.nProt || undefined,
      };
    }

    const procCTeOS = parsed?.procCTeOS?.CTeOS?.infCTeOS ?? parsed?.CTeOS?.infCTeOS ?? parsed?.procCTeOS?.CTe?.infCte;
    if (procCTeOS) {
      return {
        chaveAcesso: String(procCTeOS.Id || '').replace(/^CTeOS/i, '').replace(/^CTe/i, '') || '',
        tipo: tipo as DocumentoFiscal['tipo'],
        numero: String(procCTeOS.ide?.nCT || procCTeOS.ide?.nDoc || '').replace(/^0+/, ''),
        serie: String(procCTeOS.ide?.serie || '').replace(/^0+/, ''),
        dataEmissao: procCTeOS.ide?.dhEmi || new Date().toISOString(),
        cnpjEmitente: procCTeOS.emit?.CNPJ || '',
        razaoSocialEmitente: procCTeOS.emit?.xNome || '',
        cnpjDestinatario: procCTeOS.tomador?.CNPJ || procCTeOS.dest?.CNPJ || undefined,
        razaoSocialDestinatario: procCTeOS.tomador?.xNome || procCTeOS.dest?.xNome || undefined,
        valorTotal: String(procCTeOS.vPrest?.vTPrest || procCTeOS.total?.vTPrest || '0'),
        status: 'autorizada',
        xml,
        protocolo: parsed?.procCTeOS?.protCTeOS?.infProt?.nProt || parsed?.protCTe?.infProt?.nProt || undefined,
      };
    }

    const procCTe = parsed?.cteProc?.CTe?.infCte ?? parsed?.procCTe?.CTe?.infCte ?? parsed?.CTe?.infCte;
    if (procCTe) {
      return {
        chaveAcesso: String(procCTe.Id || '').replace(/^CTe/i, '') || '',
        tipo: tipo as DocumentoFiscal['tipo'],
        numero: String(procCTe.ide?.nCT || procCTe.ide?.nDoc || '').replace(/^0+/, ''),
        serie: String(procCTe.ide?.serie || '').replace(/^0+/, ''),
        dataEmissao: procCTe.ide?.dhEmi || new Date().toISOString(),
        cnpjEmitente: procCTe.emit?.CNPJ || '',
        razaoSocialEmitente: procCTe.emit?.xNome || '',
        cnpjDestinatario: procCTe.dest?.CNPJ || undefined,
        razaoSocialDestinatario: procCTe.dest?.xNome || undefined,
        valorTotal: String(procCTe.vPrest?.vTPrest || procCTe.total?.vTPrest || procCTe.total?.vRec || '0'),
        status: 'autorizada',
        xml,
        protocolo: parsed?.cteProc?.protCTe?.infProt?.nProt || parsed?.procCTe?.protCTe?.infProt?.nProt || parsed?.protCTe?.infProt?.nProt || undefined,
      };
    }

    const procDCe = parsed?.procDCe?.DCe?.infDCe ?? parsed?.DCe?.infDCe;
    if (procDCe) {
      return {
        chaveAcesso: String(procDCe.Id || '').replace(/^DCe/i, '') || '',
        tipo: tipo as DocumentoFiscal['tipo'],
        numero: String(procDCe.ide?.nDce || procDCe.ide?.nDoc || '').replace(/^0+/, ''),
        serie: String(procDCe.ide?.serie || '').replace(/^0+/, ''),
        dataEmissao: procDCe.ide?.dhEmi || new Date().toISOString(),
        cnpjEmitente: procDCe.emit?.CNPJ || '',
        razaoSocialEmitente: procDCe.emit?.xNome || '',
        cnpjDestinatario: procDCe.dest?.CNPJ || undefined,
        razaoSocialDestinatario: procDCe.dest?.xNome || undefined,
        valorTotal: String(procDCe.total?.vDce || procDCe.total?.vNF || '0'),
        status: 'autorizada',
        xml,
        protocolo: parsed?.procDCe?.protDCe?.infProt?.nProt || parsed?.protDCe?.infProt?.nProt || undefined,
      };
    }

    const resNFe = parsed?.resNFe || parsed?.resNFCe || parsed?.resCTe || parsed?.resMDFe || parsed?.resBPe || parsed?.resCTeOS || parsed?.resDCe;
    if (resNFe) {
      const chave = String(
        resNFe.chNFe || resNFe.chaveAcesso || resNFe.chCTe || resNFe.chMDFe || resNFe.chBPe || resNFe.chCTeOS || resNFe.chDCe || '',
      ).replace(/\D/g, '');
      if (!chave) return null;

      const total = resNFe.vNF || resNFe.vTPrest || resNFe.vCarga || resNFe.vBPe || resNFe.vDce || '0';
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

function montarConsultaPorChaveSoap(tipo: DocumentoFiscal['tipo'], chave: string, ambiente: 1 | 2): {
  urlServico: string;
  action: string;
  envelope: string;
  resultadoRegex: RegExp;
} | null {
  const escaparXml = (valor: string) => valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  if (tipo === 'bpe') {
    return {
      urlServico: '',
      action: 'http://www.portalfiscal.inf.br/bpe/wsdl/BPeConsulta/BPeConsulta',
      envelope: `<BPeConsulta xmlns="http://www.portalfiscal.inf.br/bpe/wsdl/BPeConsulta"><bPeDadosMsg><consSitBPe xmlns="http://www.portalfiscal.inf.br/bpe" versao="1.00"><tpAmb>${ambiente}</tpAmb><xServ>CONSULTAR</xServ><chBPe>${chave}</chBPe></consSitBPe></bPeDadosMsg></BPeConsulta>`,
      resultadoRegex: /<BPeConsultaResult[^>]*>([\s\S]*?)<\/BPeConsultaResult>/,
    };
  }

  if (tipo === 'cteos') {
    const payload = `<consSitCTe xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00"><tpAmb>${ambiente}</tpAmb><xServ>CONSULTAR</xServ><chCTe>${chave}</chCTe></consSitCTe>`;
    return {
      urlServico: '',
      action: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4/cteConsultaCT',
      envelope: `<cteConsultaCT xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4"><cteDadosMsg>${escaparXml(payload)}</cteDadosMsg></cteConsultaCT>`,
      resultadoRegex: /<cteConsultaCTResult[^>]*>([\s\S]*?)<\/cteConsultaCTResult>/,
    };
  }

  if (tipo === 'cte') {
    const payload = `<consSitCTe xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00"><tpAmb>${ambiente}</tpAmb><xServ>CONSULTAR</xServ><chCTe>${chave}</chCTe></consSitCTe>`;
    return {
      urlServico: '',
      action: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4/cteConsultaCT',
      envelope: `<cteConsultaCT xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4"><cteDadosMsg>${escaparXml(payload)}</cteDadosMsg></cteConsultaCT>`,
      resultadoRegex: /<cteConsultaCTResult[^>]*>([\s\S]*?)<\/cteConsultaCTResult>/,
    };
  }

  if (tipo === 'dce') {
    return {
      urlServico: '',
      action: 'http://www.portalfiscal.inf.br/dce/wsdl/DCeConsulta/DCeConsulta',
      envelope: `<DCeConsulta xmlns="http://www.portalfiscal.inf.br/dce/wsdl/DCeConsulta"><dceDadosMsg><consSitDCe xmlns="http://www.portalfiscal.inf.br/dce" versao="1.00"><tpAmb>${ambiente}</tpAmb><xServ>CONSULTAR</xServ><chDCe>${chave}</chDCe></consSitDCe></dceDadosMsg></DCeConsulta>`,
      resultadoRegex: /<DCeConsultaResult[^>]*>([\s\S]*?)<\/DCeConsultaResult>/,
    };
  }

  return null;
}

async function consultarDocumentoOficialPorChave(
  chave: string,
  tipo: DocumentoFiscal['tipo'],
  config: SdkConfig,
): Promise<ConsultaResultado> {
  if (!config.certificado) {
    return { sucesso: false, erro: 'Certificado digital nao configurado', fonte: 'mock' };
  }

  const info = parseChaveAcesso(chave);
  const uf = info?.ufSigla || config.ufPadrao || 'PR';
  const endpoints = montarEndpoints(config.ambiente);

  if (tipo === 'cte') {
    const distDFeUrl = getServiceUrl(endpoints, uf, 'cteDistDFeInteresse');
    if (!distDFeUrl) {
      return { sucesso: false, erro: `Endpoint oficial indisponivel para CTE/${uf}`, fonte: 'sefaz' };
    }

    try {
      const cert = carregarCertificado(config.certificado.caminho, config.certificado.senha);
      const body = `<cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">
        <cteDadosMsg>
          <distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00">
            <tpAmb>${config.ambiente}</tpAmb>
            <cUFAutor>${info?.uf || uf}</cUFAutor>
            <CNPJ>${cert.cnpj}</CNPJ>
            <consChCTe>
              <chCTe>${chave}</chCTe>
            </consChCTe>
          </distDFeInt>
        </cteDadosMsg>
      </cteDistDFeInteresse>`;

      const action = 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe/cteDistDFeInteresse';
      const response = await enviarSOAPComCert(
        distDFeUrl,
        montarEnvelope(body, '1.2'),
        action,
        config.certificado.caminho,
        config.certificado.senha,
        config.timeout || 60000,
        '1.2',
      );

      if (response.statusCode === 200) {
        const parsed = parser.parse(response.body);
        const inner = encontrarXmlAninhado(parsed) || response.body;
        const result = inner.match(/<cteDistDFeInteresseResult[^>]*>([\s\S]*?)<\/cteDistDFeInteresseResult>/)?.[1] || inner;
        const docZip = result.match(/<docZip[^>]*>([^<]+)<\/docZip>/)?.[1] || null;

        if (docZip) {
          const xmlDecoded = decodificarDocZip(docZip);
          const doc = parseDocumentoFromXML(xmlDecoded, tipo);
          if (doc) {
            return { sucesso: true, documento: { ...doc, xml: xmlDecoded }, fonte: 'sefaz' };
          }
        }
      }
    } catch (error: any) {
      return {
        sucesso: false,
        erro: error?.message || 'Erro na distribuicao CT-e',
        fonte: 'sefaz',
      };
    }
  }

  const serviceMap: Record<string, string> = {
    cte: 'cteConsulta',
    bpe: 'bpeConsulta',
    cteos: 'cteosConsulta',
    dce: 'dceConsulta',
  };
  const serviceName = serviceMap[tipo];
  const serviceUrl = getServiceUrl(endpoints, uf, serviceName);
  if (!serviceUrl) {
    return { sucesso: false, erro: `Endpoint oficial indisponivel para ${tipo.toUpperCase()}/${uf}`, fonte: 'sefaz' };
  }

  const consulta = montarConsultaPorChaveSoap(tipo, chave, config.ambiente);
  if (!consulta) {
    return { sucesso: false, erro: `Consulta oficial nao configurada para ${tipo}`, fonte: 'mock' };
  }

  try {
    carregarCertificado(config.certificado.caminho, config.certificado.senha);
    const soapVersion: '1.1' | '1.2' = tipo === 'cte' || tipo === 'cteos' ? '1.2' : '1.1';
    const response = await enviarSOAPComCert(
      serviceUrl,
      montarEnvelope(consulta.envelope, soapVersion),
      consulta.action,
      config.certificado.caminho,
      config.certificado.senha,
      config.timeout || 60000,
      soapVersion,
    );

    if (response.statusCode !== 200) {
      const fault = response.body.match(/<faultstring>([^<]+)<\/faultstring>/)
        || response.body.match(/<soap:Text[^>]*>([^<]+)<\/soap:Text>/)
        || response.body.match(/<Text[^>]*>([^<]+)<\/Text>/);
      return {
        sucesso: false,
        erro: fault ? fault[1] : `HTTP ${response.statusCode}: ${response.body.slice(0, 500)}`,
        fonte: 'sefaz',
      };
    }

    const parsed = parser.parse(response.body);
    const inner = encontrarXmlAninhado(parsed) || response.body;
    const result = inner.match(consulta.resultadoRegex)?.[1] || inner;
    const doc = parseDocumentoFromXML(result, tipo);
    if (!doc) {
      return {
        sucesso: false,
        erro: `Nao foi possivel interpretar o XML retornado pela ${tipo.toUpperCase()}: ${result.slice(0, 400)}`,
        fonte: 'sefaz',
      };
    }

    return { sucesso: true, documento: { ...doc, xml: result }, fonte: 'sefaz' };
  } catch (error: any) {
    return { sucesso: false, erro: error.message || `Erro na consulta ${tipo.toUpperCase()}`, fonte: 'sefaz' };
  }
}

function gerarRespostaDaChave(info: InfoChave): DocumentoFiscal {
  const docs: Record<string, DocumentoFiscal['tipo']> = {
    '55': 'nfe', '65': 'nfce', '57': 'cte', '58': 'mdfe', '63': 'bpe', '67': 'cteos',
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

    if (tipoDetectado === 'dce') {
      const oficial = await consultarDocumentoOficialPorChave(chave, 'dce', config);
      if (oficial.sucesso) return oficial;
    }

    return { sucesso: false, erro: 'Consulta oficial indisponivel para este documento', fonte: 'sefaz' };
  }

  if (tipoDetectado === 'bpe' || tipoDetectado === 'cteos') {
    const oficial = await consultarDocumentoOficialPorChave(chave, tipoDetectado, config);
    if (oficial.sucesso) return oficial;

    return {
      sucesso: false,
      erro: `Consulta oficial indisponivel para ${tipoDetectado.toUpperCase()}`,
      fonte: 'sefaz',
    };
  }

  if (tipoDetectado === 'cte') {
    const oficial = await consultarDocumentoOficialPorChave(chave, 'cte', config);
    if (oficial.sucesso) return oficial;

    return {
      sucesso: false,
      erro: oficial.erro || 'Consulta oficial indisponivel para CTE',
      fonte: 'sefaz',
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
    return {
      sucesso: false,
      erro: 'Certificado digital nao configurado',
      fonte: 'mock',
    };
  }

  try {
    const cert = carregarCertificado(config.certificado.caminho, config.certificado.senha);
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
          <CNPJ>${cert.cnpj}</CNPJ>
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
    return {
      sucesso: false,
      erro: error.message || 'Erro na consulta SEFAZ',
      fonte: 'sefaz',
    };
  }
}
