import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { documentos } from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { consultarNFeporChave } from '@dfecentral/sdk';
import type { SdkConfig } from '@dfecentral/sdk';
import { buscarNoCache, salvarNoCache, docParaFiscal } from '../db/cache';

function getSdkConfig(): SdkConfig {
  return {
    ambiente: (Number(process.env.SEFAZ_AMBIENTE) || 2) as 1 | 2,
    certificado: process.env.SEFAZ_CERT_PATH && process.env.SEFAZ_CERT_PASS
      ? { caminho: process.env.SEFAZ_CERT_PATH, senha: process.env.SEFAZ_CERT_PASS }
      : undefined,
    scraperUrl: process.env.SCRAPER_URL || '',
    timeout: 45000,
  };
}

const documentoSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    chaveAcesso: { type: 'string', example: '35240312345678000195550010000001231234567890' },
    tipo: { type: 'string', enum: ['nfe', 'nfce', 'nfse', 'cte', 'mdfe', 'dce'] },
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
      return reply.status(400).send({ sucesso: false, erro: 'Chave de acesso deve ter 44 dígitos numéricos' });
    }

    const config = getSdkConfig();
    const resultado = await consultarComCache(chave, config);

    if (!resultado.sucesso) {
      return reply.status(404).send({ sucesso: false, erro: resultado.erro || 'NF-e não encontrada' });
    }

    return { sucesso: true, dados: { ...resultado.documento, fonte: resultado.fonte } };
  });

  app.get('/:chave/xml', async (request, reply) => {
    const { chave } = request.params as { chave: string };
    if (!/^\d{44}$/.test(chave)) {
      return reply.status(400).send({ sucesso: false, erro: 'Chave de acesso deve ter 44 dígitos numéricos' });
    }

    const cache = await buscarNoCache(chave);
    if (cache?.xml) {
      return reply.type('application/xml').send(cache.xml);
    }

    const config = getSdkConfig();
    const resultado = await consultarNFeporChave({ chaveAcesso: chave }, config);

    if (!resultado.sucesso || !resultado.documento?.xml) {
      return reply.status(404).send({ sucesso: false, erro: 'XML não disponível para esta chave' });
    }

    await salvarNoCache(resultado.documento);
    return reply.type('application/xml').send(resultado.documento.xml);
  });

  app.get('/', async (request, reply) => {
    const { cnpj, tipo = 'todas', dataInicio, dataFim, pagina = 1, limite = 20 } = request.query as any;

    if (!cnpj || !/^\d{14}$/.test(cnpj)) {
      return reply.status(400).send({ sucesso: false, erro: 'CNPJ deve ter 14 dígitos numéricos' });
    }

    const conditions = [eq(documentos.tipo, 'nfe')];

    if (tipo === 'emitidas') {
      conditions.push(eq(documentos.cnpjEmitente, cnpj));
    } else if (tipo === 'recebidas') {
      conditions.push(eq(documentos.cnpjDestinatario, cnpj));
    } else {
      conditions.push(eq(documentos.cnpjEmitente, cnpj));
    }

    if (dataInicio) conditions.push(gte(documentos.dataEmissao, new Date(dataInicio)));
    if (dataFim) conditions.push(lte(documentos.dataEmissao, new Date(dataFim)));

    const offset = (pagina - 1) * limite;
    const resultados = await db
      .select()
      .from(documentos)
      .where(and(...conditions))
      .orderBy(desc(documentos.dataEmissao))
      .limit(limite)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentos)
      .where(and(...conditions));

    return {
      sucesso: true,
      dados: { documentos: resultados, total: Number(count), pagina, limite, paginas: Math.ceil(Number(count) / limite) },
    };
  });
}
