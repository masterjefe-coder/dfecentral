import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { documentos } from '../db/schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { consultarNFeporChave } from '@dfecentral/sdk';
import type { SdkConfig } from '@dfecentral/sdk';
import { buscarNoCache, salvarNoCache, docParaFiscal } from '../db/cache.js';
import { gerarPdfDanfe } from '../utils/danfe.js';
import { registrarConsulta } from '../db/audit.js';
import { arquivarXmlEmR2, enviarXmlContabilidadeAutomatico } from '../utils/contabilidade.js';

function tipoDaChave(chave: string) {
  const modelo = chave.slice(20, 22);
  if (modelo === '55') return 'nfe' as const;
  if (modelo === '65') return 'nfce' as const;
  if (modelo === '57') return 'cte' as const;
  if (modelo === '58') return 'mdfe' as const;
  return null;
}

function getSdkConfig(): SdkConfig {
  return {
    ambiente: (Number(process.env.SEFAZ_AMBIENTE) || 1) as 1 | 2,
    certificado:
      process.env.SEFAZ_CERT_PATH && process.env.SEFAZ_CERT_PASS
        ? { caminho: process.env.SEFAZ_CERT_PATH, senha: process.env.SEFAZ_CERT_PASS }
        : undefined,
    timeout: 45000,
  };
}

const documentoSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    chaveAcesso: { type: 'string', example: '35240312345678000195550010000001231234567890' },
    tipo: { type: 'string', enum: ['nfe', 'nfce', 'nfse', 'cte', 'mdfe', 'bpe', 'cteos', 'dce'] },
    numero: { type: 'string', example: '123' },
    serie: { type: 'string', example: '1' },
    dataEmissao: { type: 'string', format: 'date-time' },
    cnpjEmitente: { type: 'string', example: '12345678000195' },
    razaoSocialEmitente: { type: 'string' },
    cnpjDestinatario: { type: 'string' },
    valorTotal: { type: 'string', example: '1500.00' },
    status: { type: 'string', enum: ['autorizada', 'cancelada', 'denegada', 'inutilizada', 'pendente', 'processando', 'erro'] },
    protocolo: { type: 'string' },
    fonte: { type: 'string' },
  },
};

const consultaSchema = {
  tags: ['NF-e'],
  summary: 'Consulta NF-e por chave de acesso',
  params: {
    type: 'object',
    required: ['chave'],
    properties: {
      chave: { type: 'string', minLength: 44, maxLength: 44 },
    },
  },
  response: {
    200: { type: 'object', properties: { sucesso: { type: 'boolean' }, dados: documentoSchema }, additionalProperties: true },
    400: { type: 'object', properties: { sucesso: { type: 'boolean' }, erro: { type: 'string' } } },
    404: { type: 'object', properties: { sucesso: { type: 'boolean' }, erro: { type: 'string' } } },
  },
};

async function consultarComCache(chave: string, config: SdkConfig) {
  const cache = await buscarNoCache(chave);
  if (cache?.xml) {
    return { sucesso: true, documento: docParaFiscal(cache), fonte: 'cache' as const };
  }

  const resultado = await consultarNFeporChave({ chaveAcesso: chave }, config);
  if (resultado.sucesso && resultado.documento) {
    await salvarNoCache(resultado.documento);
  }
  return resultado;
}

export async function nfeRoutes(app: FastifyInstance) {
  app.get('/:chave', { schema: consultaSchema }, async (request, reply) => {
    const { chave } = request.params as { chave: string };
    if (!/^\d{44}$/.test(chave)) {
      return reply.status(400).send({ sucesso: false, erro: 'Chave de acesso deve ter 44 digitos numericos' });
    }

    const tipoEsperado = tipoDaChave(chave);
    if (!tipoEsperado) {
      return reply.status(400).send({ sucesso: false, erro: 'Nao foi possivel identificar o tipo pela chave' });
    }
    if (tipoEsperado !== 'nfe') {
      return reply.status(400).send({ sucesso: false, erro: `A chave informada corresponde a ${tipoEsperado.toUpperCase()}` });
    }

    const config = getSdkConfig();
    const resultado = await consultarComCache(chave, config);
    const usuarioId = (request as any).conta?.id;

    if (!resultado.sucesso) {
      await registrarConsulta({ tipo: 'nfe', consulta: chave, resultado: 'erro', ip: request.ip, usuarioId });
      return reply.status(404).send({ sucesso: false, erro: resultado.erro || 'NF-e nao encontrada' });
    }

    if (resultado.fonte !== 'cache' && resultado.documento?.xml && usuarioId) {
      try {
        await enviarXmlContabilidadeAutomatico({
          usuarioId,
          chave: resultado.documento.chaveAcesso,
          xml: resultado.documento.xml,
        });
      } catch (error) {
        console.error('[contabilidade] erro no envio automatico:', error);
      }
    }

    await registrarConsulta({ tipo: 'nfe', consulta: chave, resultado: 'sucesso', ip: request.ip, usuarioId });

    return { sucesso: true, dados: { ...resultado.documento, fonte: resultado.fonte } };
  });

  app.get('/:chave/xml', async (request, reply) => {
    const { chave } = request.params as { chave: string };
    const formato = String((request.query as { format?: string })?.format || '').toLowerCase();
    if (!/^\d{44}$/.test(chave)) {
      return reply.status(400).send({ sucesso: false, erro: 'Chave de acesso deve ter 44 digitos numericos' });
    }

    const tipoEsperado = tipoDaChave(chave);
    if (!tipoEsperado) {
      return reply.status(400).send({ sucesso: false, erro: 'Nao foi possivel identificar o tipo pela chave' });
    }
    if (tipoEsperado !== 'nfe') {
      return reply.status(400).send({ sucesso: false, erro: `A chave informada corresponde a ${tipoEsperado.toUpperCase()}` });
    }

    const cache = await buscarNoCache(chave);
    const usuarioId = (request as any).conta?.id;
    if ((formato === 'danfe' || formato === 'pdf') && cache?.xml) {
      await registrarConsulta({ tipo: 'nfe:xml', consulta: chave, resultado: 'sucesso', ip: request.ip, usuarioId });
      const pdf = await gerarPdfDanfe(docParaFiscal(cache));
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="danfe-${chave}.pdf"`)
        .send(pdf);
    }

    if (cache?.xml) {
      await registrarConsulta({ tipo: 'nfe:xml', consulta: chave, resultado: 'sucesso', ip: request.ip, usuarioId });
      return reply.type('application/xml').send(cache.xml);
    }

    const config = getSdkConfig();
    const resultado = await consultarNFeporChave({ chaveAcesso: chave }, config);

    if (!resultado.sucesso || !resultado.documento?.xml) {
      await registrarConsulta({ tipo: 'nfe:xml', consulta: chave, resultado: 'erro', ip: request.ip, usuarioId });
      return reply.status(404).send({ sucesso: false, erro: 'XML nao disponivel para esta chave' });
    }

    await salvarNoCache(resultado.documento);
    try {
      await enviarXmlContabilidadeAutomatico({
        usuarioId,
        chave: resultado.documento.chaveAcesso,
        xml: resultado.documento.xml,
      });
      await arquivarXmlEmR2({
        chave: resultado.documento.chaveAcesso,
        xml: resultado.documento.xml,
        dataEmissao: new Date(resultado.documento.dataEmissao),
        tipo: 'nfe',
        direcao: 'emitidas',
      });
    } catch (error) {
      console.error('[contabilidade] erro no envio automatico:', error);
    }
    await registrarConsulta({ tipo: 'nfe:xml', consulta: chave, resultado: 'sucesso', ip: request.ip, usuarioId });
    if (formato === 'danfe' || formato === 'pdf') {
      const pdf = await gerarPdfDanfe(resultado.documento);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="danfe-${chave}.pdf"`)
        .send(pdf);
    }

    return reply.type('application/xml').send(resultado.documento.xml);
  });

  app.get('/', async (request, reply) => {
    const { cnpj, tipo = 'todas', movimento, dataInicio, dataFim, pagina = 1, limite = 20 } = request.query as any;
    const paginaNum = Math.max(1, Number(pagina) || 1);
    const limiteNum = Math.min(100, Math.max(1, Number(limite) || 20));
    const filtroMovimento = String(movimento || tipo || 'emitidas');

    if (!cnpj || !/^\d{14}$/.test(cnpj)) {
      return reply.status(400).send({ sucesso: false, erro: 'CNPJ deve ter 14 digitos numericos' });
    }

    if ((dataInicio && Number.isNaN(new Date(dataInicio).getTime())) || (dataFim && Number.isNaN(new Date(dataFim).getTime()))) {
      return reply.status(400).send({ sucesso: false, erro: 'Datas devem estar em formato ISO valido' });
    }

    const conditions = [eq(documentos.tipo, 'nfe')];

    if (filtroMovimento === 'emitidas') {
      conditions.push(eq(documentos.cnpjEmitente, cnpj));
    } else if (filtroMovimento === 'recebidas') {
      conditions.push(eq(documentos.cnpjDestinatario, cnpj));
    } else {
      conditions.push(eq(documentos.cnpjEmitente, cnpj));
    }

    if (dataInicio) conditions.push(gte(documentos.dataEmissao, new Date(dataInicio)));
    if (dataFim) conditions.push(lte(documentos.dataEmissao, new Date(dataFim)));

    const offset = (paginaNum - 1) * limiteNum;
    const resultados = await db
      .select()
      .from(documentos)
      .where(and(...conditions))
      .orderBy(desc(documentos.dataEmissao))
      .limit(limiteNum)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentos)
      .where(and(...conditions));

    return {
      sucesso: true,
      dados: {
        documentos: resultados,
        total: Number(count),
        pagina: paginaNum,
        limite: limiteNum,
        paginas: Math.max(1, Math.ceil(Number(count) / limiteNum)),
      },
    };
  });
}
