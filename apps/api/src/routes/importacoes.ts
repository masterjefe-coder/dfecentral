import type { FastifyInstance } from 'fastify';
import { carregarCertificado, decodificarDocZip, enviarSOAPComCert, getServiceUrl, inferirTipoDocumentoXml, montarEnvelope, montarEndpoints, obterUfAutorEnv, parseDocumentoFiscalXml, type TipoDocumento } from '@dfecentral/sdk';
import JSZip from 'jszip';
import { salvarNoCache } from '../db/cache.js';
import { registrarConsulta } from '../db/audit.js';
import { obterDistribuicaoDfe, salvarDistribuicaoDfe } from '../db/distribuicoes.js';
import { obterSdkConfigComCertificado } from '../utils/certificados.js';

type Importavel = 'nfe' | 'nfce' | 'cte' | 'mdfe';

const SUPORTADOS = new Set<Importavel>(['nfe', 'nfce', 'cte', 'mdfe']);

const CONFIG: Record<Importavel, { urlKey: string; requestTag: string; serviceNamespace: string; action: string }> = {
  nfe: { urlKey: 'nfeDistDFeInteresse', requestTag: 'nfeDistDFeInteresse', serviceNamespace: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe', action: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse' },
  nfce: { urlKey: 'nfceDistDFeInteresse', requestTag: 'nfeDistDFeInteresse', serviceNamespace: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe', action: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse' },
  cte: { urlKey: 'cteDistDFeInteresse', requestTag: 'cteDistDFeInteresse', serviceNamespace: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe', action: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe/cteDistDFeInteresse' },
  mdfe: { urlKey: 'mdfeDistDFeInteresse', requestTag: 'mdfeDistDFeInteresse', serviceNamespace: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe', action: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe/mdfeDistDFeInteresse' },
};

const MSG_TAG: Record<Importavel, string> = {
  nfe: 'nfeDadosMsg',
  nfce: 'nfeDadosMsg',
  cte: 'cteDadosMsg',
  mdfe: 'mdfeDadosMsg',
};

const INTERVALO_NORMAL_MS = 5 * 60 * 1000;
const INTERVALO_ERRO_MS = 15 * 60 * 1000;
const INTERVALO_656_MS = 60 * 60 * 1000;

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

function parseCStat(body: string): string {
  const match = body.match(/<cStat>(\d+)<\/cStat>/);
  return match ? match[1] : '0';
}

function parseXMotivo(body: string): string {
  const match = body.match(/<xMotivo>([^<]+)<\/xMotivo>/);
  return match ? match[1] : '';
}

type XmlUploadItem = {
  nome?: string;
  tipo?: 'xml' | 'zip';
  xml?: string;
  base64?: string;
};

function nomeArquivo(item: XmlUploadItem): string {
  return String(item.nome || 'xml').trim() || 'xml';
}

async function expandirItensXml(itens: XmlUploadItem[]): Promise<Array<{ nome: string; xml: string }>> {
  const saida: Array<{ nome: string; xml: string }> = [];

  for (const item of itens) {
    const nome = nomeArquivo(item);
    if ((item.tipo || 'xml') === 'zip') {
      const conteudoBase64 = String(item.base64 || '').trim();
      if (!conteudoBase64) continue;

      const zip = await JSZip.loadAsync(Buffer.from(conteudoBase64, 'base64'));
      const entradas = Object.values(zip.files);

      for (const entrada of entradas) {
        if (entrada.dir) continue;
        if (!/\.xml$/i.test(entrada.name)) continue;

        const xml = await entrada.async('string');
        saida.push({ nome: `${nome}/${entrada.name}`, xml });
      }

      continue;
    }

    const xml = String(item.xml || '').trim();
    if (xml) saida.push({ nome, xml });
  }

  return saida;
}

async function importarXmlManual(itens: XmlUploadItem[], usuarioId?: string) {
  const expandido = await expandirItensXml(itens);
  const importados: Array<{ nome: string; tipo: TipoDocumento; chaveAcesso: string }> = [];
  const erros: Array<{ nome: string; erro: string }> = [];

  for (const item of expandido) {
    const nome = item.nome;
    const xml = String(item.xml || '').trim();
    if (!xml) {
      erros.push({ nome, erro: 'XML vazio' });
      continue;
    }

    const tipo = inferirTipoDocumentoXml(xml);
    if (!tipo) {
      erros.push({ nome, erro: 'Nao foi possivel identificar o tipo do XML' });
      continue;
    }

    const documento = parseDocumentoFiscalXml(xml, tipo);
    if (!documento) {
      erros.push({ nome, erro: `Nao foi possivel interpretar o XML (${tipo.toUpperCase()})` });
      continue;
    }

    await salvarNoCache(documento);
    importados.push({ nome, tipo: documento.tipo, chaveAcesso: documento.chaveAcesso });
  }

  return { importados, erros, usuarioId };
}

async function executarImportacaoDistribuicao(tipo: Importavel, cnpj: string, uf: string, ultNSUInicial = '000000000000000', usuarioId?: string) {
  const { config, cleanup } = await obterSdkConfigComCertificado({ usuarioId, cnpj });
  if (!config.certificado) throw new Error('Certificado digital nao configurado');
  const cUFAutor = obterUfAutorEnv().codigo;

  try {
    carregarCertificado(config.certificado.caminho, config.certificado.senha);

    const endpoints = montarEndpoints(config.ambiente);
    const serviceUrl = getServiceUrl(endpoints, uf, CONFIG[tipo].urlKey);
    if (!serviceUrl) throw new Error(`Endpoint indisponivel para ${uf}`);

    let ultNSU = ultNSUInicial;
    const importados: Array<{ chaveAcesso: string; tipo: TipoDocumento }> = [];
    let cStat = '0';
    let xMotivo = '';

    for (let i = 0; i < 10; i++) {
      const body = `<${CONFIG[tipo].requestTag} xmlns="${CONFIG[tipo].serviceNamespace}">
      <${MSG_TAG[tipo]}>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/${tipo === 'cte' ? 'cte' : tipo === 'mdfe' ? 'mdfe' : 'nfe'}" versao="1.01">
          <tpAmb>${config.ambiente}</tpAmb>
          <cUFAutor>${cUFAutor}</cUFAutor>
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
        '1.1',
      );

      if (resposta.statusCode !== 200) {
        const fault = resposta.body.match(/<faultstring>([^<]+)<\/faultstring>/);
        throw new Error(fault ? fault[1] : `HTTP ${resposta.statusCode}`);
      }

      const resultMatch = resposta.body.match(/<nfeDistDFeInteresseResult[^>]*>([\s\S]*?)<\/nfeDistDFeInteresseResult>/)
        || resposta.body.match(/<cteDistDFeInteresseResult[^>]*>([\s\S]*?)<\/cteDistDFeInteresseResult>/)
        || resposta.body.match(/<mdfeDistDFeInteresseResult[^>]*>([\s\S]*?)<\/mdfeDistDFeInteresseResult>/);
      const resultXml = resultMatch ? resultMatch[1] : '';
      cStat = parseCStat(resultXml);
      xMotivo = parseXMotivo(resultXml);

      for (const docZipB64 of parseDocZipTags(resultXml)) {
        const xml = decodificarDocZip(docZipB64);
        const documento = parseDocumentoFiscalXml(xml, tipo);
        if (!documento) continue;
        await salvarNoCache(documento);
        importados.push({ chaveAcesso: documento.chaveAcesso, tipo: documento.tipo });
      }

      const novoUltNSU = parseUltNSU(resultXml);
      const maxNSU = parseMaxNSU(resultXml);
      if (!novoUltNSU || novoUltNSU === ultNSU || novoUltNSU === maxNSU || ['137', '139'].includes(cStat)) {
        ultNSU = novoUltNSU || ultNSU;
        break;
      }
      ultNSU = novoUltNSU;
    }

    return { importados, ultNSU, cStat, xMotivo };
  } finally {
    cleanup?.();
  }
}

export async function importarPorTipo(tipo: Importavel, cnpj: string, uf: string, ultNSUInicial = '000000000000000', usuarioId?: string) {
  return executarImportacaoDistribuicao(tipo, cnpj, uf, ultNSUInicial, usuarioId);
}

export async function importarDistribuicaoLenta(log?: { info?: (data: unknown, message?: string) => void; warn?: (data: unknown, message?: string) => void }) {
  const { db } = await import('../db/index.js');
  const { certificadosDigitais } = await import('../db/schema.js');
  const agora = new Date();
  const ufAutor = obterUfAutorEnv('SC');
  const certificados = await db.select().from(certificadosDigitais).orderBy(certificadosDigitais.atualizadoEm);
  const porCnpj = new Map<string, typeof certificados>();

  for (const cert of certificados) {
    if (!porCnpj.has(cert.cnpj)) porCnpj.set(cert.cnpj, [] as typeof certificados);
    porCnpj.get(cert.cnpj)!.push(cert);
  }

  const resultados: Array<{ cnpj: string; uf: string; importados: number; cStat: string; xMotivo: string }> = [];

  for (const [cnpj, rows] of porCnpj) {
    const cert = rows[0];
    const cursor = await obterDistribuicaoDfe(cert.usuarioId, cnpj, 'nfe');
    if (cursor?.proximaExecucaoEm && new Date(cursor.proximaExecucaoEm).getTime() > agora.getTime()) {
      continue;
    }

    const ultNSU = cursor?.ultNsu || '000000000000000';

    try {
      const resultado = await executarImportacaoDistribuicao('nfe', cnpj, ufAutor.sigla, ultNSU, cert.usuarioId);
      const proximaExecucaoEm = new Date(
        agora.getTime() + (
          resultado.cStat === '656'
            ? INTERVALO_656_MS
            : resultado.cStat === '138'
              ? 60 * 1000
              : INTERVALO_NORMAL_MS
        )
      );

      await salvarDistribuicaoDfe({
        usuarioId: cert.usuarioId,
        cnpj,
        tipo: 'nfe',
        ufIndice: 0,
        ultNsu: resultado.ultNSU,
        ultimoCStat: resultado.cStat,
        ultimoXMotivo: resultado.xMotivo,
        proximaExecucaoEm,
      });

      resultados.push({ cnpj, uf: ufAutor.sigla, importados: resultado.importados.length, cStat: resultado.cStat, xMotivo: resultado.xMotivo });
      log?.info?.({ cnpj, uf: ufAutor.sigla, importados: resultado.importados.length, cStat: resultado.cStat }, 'Distribuicao DFe executada');
    } catch (error: any) {
      await salvarDistribuicaoDfe({
        usuarioId: cert.usuarioId,
        cnpj,
        tipo: 'nfe',
        ufIndice: 0,
        ultNsu: ultNSU,
        ultimoCStat: 'erro',
        ultimoXMotivo: error?.message || 'Falha na distribuicao DFe',
        proximaExecucaoEm: new Date(agora.getTime() + INTERVALO_ERRO_MS),
      });
      log?.warn?.({ cnpj, uf: ufAutor.sigla, erro: error?.message }, 'Falha na distribuicao DFe');
    }
  }

  return resultados;
}

export async function importacoesRoutes(app: FastifyInstance) {
  app.post('/xml', async (request, reply) => {
    const body = request.body as { arquivos?: XmlUploadItem[] } | undefined;
    const arquivos = Array.isArray(body?.arquivos) ? body!.arquivos : [];

    if (arquivos.length === 0) {
      return reply.status(400).send({ sucesso: false, erro: 'Nenhum XML enviado' });
    }

    try {
      const usuarioId = (request as any).conta?.id;
      const resultado = await importarXmlManual(arquivos, usuarioId);

      await registrarConsulta({
        tipo: 'importacao:xml',
        consulta: String(arquivos.length),
        resultado: `sucesso:${resultado.importados.length}:${resultado.erros.length}`,
        ip: request.ip,
        usuarioId,
      });

      return {
        sucesso: true,
        importados: resultado.importados.length,
        erros: resultado.erros,
        documentos: resultado.importados,
      };
    } catch (error: any) {
      return reply.status(500).send({ sucesso: false, erro: error?.message || 'Falha ao importar XML' });
    }
  });

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
      const usuarioId = (request as any).conta?.id;
      const resultado = await executarImportacaoDistribuicao(tipo as Importavel, cnpj, uf, ultNSU, usuarioId);
      await registrarConsulta({
        tipo: `importacao:${tipo}`,
        consulta: cnpj,
        resultado: `sucesso:${resultado.importados.length}:${resultado.cStat}`,
        ip: request.ip,
        usuarioId,
      });

      return {
        sucesso: true,
        tipo,
        importados: resultado.importados.length,
        ultNSU: resultado.ultNSU,
        cStat: resultado.cStat,
        xMotivo: resultado.xMotivo,
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

  app.post('/sincronizar', async (request) => {
    const usuarioId = (request as any).conta?.id;
    const resultados = await importarDistribuicaoLenta(app.log);
    return { sucesso: true, usuarioId, resultados };
  });
}
