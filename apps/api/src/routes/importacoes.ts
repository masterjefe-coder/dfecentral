import type { FastifyInstance } from 'fastify';
import { carregarCertificado, montarEndpoints, getServiceUrl, enviarSOAPComCert, montarEnvelope, parseDocumentoFiscalXml, decodificarDocZip, type TipoDocumento, type SdkConfig } from '@dfecentral/sdk';
import { salvarNoCache } from '../db/cache.js';
import { registrarConsulta } from '../db/audit.js';

function getSdkConfig(): SdkConfig {
  return {
    ambiente: (Number(process.env.SEFAZ_AMBIENTE) || 2) as 1 | 2,
    certificado:
      process.env.SEFAZ_CERT_PATH && process.env.SEFAZ_CERT_PASS
        ? { caminho: process.env.SEFAZ_CERT_PATH, senha: process.env.SEFAZ_CERT_PASS }
        : undefined,
    scraperUrl: process.env.SCRAPER_URL || '',
    timeout: 45000,
  };
}

type Importavel = Exclude<TipoDocumento, 'nfse' | 'dce'>;

const SUPORTADOS = new Set<Importavel>(['nfe', 'nfce', 'cte', 'mdfe']);

const CONFIG: Record<Importavel, { urlKey: string; requestTag: string; serviceNamespace: string; action: string }> = {
  nfe: {
    urlKey: 'nfeDistDFeInteresse',
    requestTag: 'nfeDistDFeInteresse',
    serviceNamespace: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe',
    action: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
  },
  nfce: {
    urlKey: 'nfceDistDFeInteresse',
    requestTag: 'nfeDistDFeInteresse',
    serviceNamespace: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe',
    action: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
  },
  cte: {
    urlKey: 'cteDistDFeInteresse',
    requestTag: 'cteDistDFeInteresse',
    serviceNamespace: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe',
    action: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe/cteDistDFeInteresse',
  },
  mdfe: {
    urlKey: 'mdfeDistDFeInteresse',
    requestTag: 'mdfeDistDFeInteresse',
    serviceNamespace: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe',
    action: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe/mdfeDistDFeInteresse',
  },
};

const MSG_TAG: Record<Importavel, string> = {
  nfe: 'nfeDadosMsg',
  nfce: 'nfeDadosMsg',
  cte: 'cteDadosMsg',
  mdfe: 'mdfeDadosMsg',
};

function parseDocZipTags(body: string): string[] {
  return [...body.matchAll(/<docZip[^>]*>([^<]+)<\/docZip>/g)].map((match) => match[1]);
}

function parseUltNSU(body: string): string {
  const match = body.match(/<ultNSU>(\d+)<\/ultNSU>/);
  return match ? match[1] : '0';
}

function parseMaxNSU(body: string): string {
  const match = body.match(/<maxNSU>(\d+)<\/maxNSU>/);
  return match ? match[1] : '0';
}

async function importarPorTipo(tipo: Importavel, cnpj: string, uf: string, ultNSUInicial = '000000000000000') {
  const config = getSdkConfig();
  if (!config.certificado) {
    throw new Error('Certificado digital nao configurado');
  }

  carregarCertificado(config.certificado.caminho, config.certificado.senha);

  const endpoints = montarEndpoints(config.ambiente);
  const serviceUrl = getServiceUrl(endpoints, uf, CONFIG[tipo].urlKey);
  if (!serviceUrl) {
    throw new Error(`Endpoint indisponivel para ${uf}`);
  }

  let ultNSU = ultNSUInicial;
  const importados: Array<{ chaveAcesso: string; tipo: TipoDocumento }> = [];
  const maxIteracoes = 10;

  for (let i = 0; i < maxIteracoes; i++) {
    const body = `<${CONFIG[tipo].requestTag} xmlns="${CONFIG[tipo].serviceNamespace}">
      <${MSG_TAG[tipo]}>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/${tipo === 'cte' ? 'cte' : tipo === 'mdfe' ? 'mdfe' : 'nfe'}" versao="1.01">
          <tpAmb>${config.ambiente}</tpAmb>
          <cUFAutor>${uf}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${ultNSU}</ultNSU>
          </distNSU>
        </distDFeInt>
      </${MSG_TAG[tipo]}>
    </${CONFIG[tipo].requestTag}>`;

    const envelope = montarEnvelope(body);
    const resposta = await enviarSOAPComCert(
      serviceUrl,
      envelope,
      CONFIG[tipo].action,
      config.certificado.caminho,
      config.certificado.senha,
      config.timeout || 60000,
    );

    if (resposta.statusCode !== 200) {
      const fault = resposta.body.match(/<faultstring>([^<]+)<\/faultstring>/);
      throw new Error(fault ? fault[1] : `HTTP ${resposta.statusCode}`);
    }

    const resultMatch = resposta.body.match(/<nfeDistDFeInteresseResult[^>]*>([\s\S]*?)<\/nfeDistDFeInteresseResult>/)
      || resposta.body.match(/<cteDistDFeInteresseResult[^>]*>([\s\S]*?)<\/cteDistDFeInteresseResult>/)
      || resposta.body.match(/<mdfeDistDFeInteresseResult[^>]*>([\s\S]*?)<\/mdfeDistDFeInteresseResult>/);
    const resultXml = resultMatch ? resultMatch[1] : '';
    const docZipList = parseDocZipTags(resultXml);

    for (const docZipB64 of docZipList) {
      const xml = decodificarDocZip(docZipB64);
      const documento = parseDocumentoFiscalXml(xml, tipo);
      if (!documento) continue;
      await salvarNoCache(documento);
      importados.push({ chaveAcesso: documento.chaveAcesso, tipo: documento.tipo });
    }

    const novoUltNSU = parseUltNSU(resultXml);
    const maxNSU = parseMaxNSU(resultXml);
    if (!novoUltNSU || novoUltNSU === ultNSU || novoUltNSU === maxNSU) {
      ultNSU = novoUltNSU || ultNSU;
      break;
    }
    ultNSU = novoUltNSU;
  }

  return { importados, ultNSU };
}

export async function importacoesRoutes(app: FastifyInstance) {
  app.post('/:tipo', async (request, reply) => {
    const { tipo } = request.params as { tipo: string };
    const body = request.body as { cnpj?: string; uf?: string; ultNSU?: string } | undefined;

    if (!SUPORTADOS.has(tipo as Importavel)) {
      return reply.status(400).send({ sucesso: false, erro: 'Tipo de documento nao suportado para importacao' });
    }

    const cnpj = String(body?.cnpj || '').replace(/\D/g, '');
    const uf = String(body?.uf || '').toUpperCase();
    const ultNSU = String(body?.ultNSU || '000000000000000').replace(/\D/g, '').padStart(15, '0').slice(0, 15);

    if (!/^\d{14}$/.test(cnpj)) {
      return reply.status(400).send({ sucesso: false, erro: 'CNPJ invalido' });
    }
    if (!/^[A-Z]{2}$/.test(uf)) {
      return reply.status(400).send({ sucesso: false, erro: 'UF invalida' });
    }

    try {
      const resultado = await importarPorTipo(tipo as Importavel, cnpj, uf, ultNSU);
      const usuarioId = (request as any).conta?.id;
      await registrarConsulta({
        tipo: `importacao:${tipo}`,
        consulta: cnpj,
        resultado: `sucesso:${resultado.importados.length}`,
        ip: request.ip,
        usuarioId,
      });
      return {
        sucesso: true,
        tipo,
        importados: resultado.importados.length,
        ultNSU: resultado.ultNSU,
        documentos: resultado.importados,
      };
    } catch (error: any) {
      const usuarioId = (request as any).conta?.id;
      await registrarConsulta({
        tipo: `importacao:${tipo}`,
        consulta: cnpj,
        resultado: 'erro',
        ip: request.ip,
        usuarioId,
      });
      return reply.status(500).send({ sucesso: false, erro: error?.message || 'Falha ao importar documentos' });
    }
  });
}
