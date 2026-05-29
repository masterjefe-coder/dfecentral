import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { documentos } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { consultarNFeporChave, parseChaveAcesso } from '@dfecentral/sdk';
import type { SdkConfig, TipoDocumento } from '@dfecentral/sdk';
import { buscarNoCache, salvarNoCache, docParaFiscal } from '../db/cache';

interface DocumentRouteOptions {
  tipo: string;
  label: string;
}

const TIPO_PARA_SDK: Record<string, TipoDocumento> = {
  nfce: 'nfce',
  nfse: 'nfse',
  cte: 'cte',
  mdfe: 'mdfe',
  dce: 'dce',
};

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
    chaveAcesso: { type: 'string' },
    tipo: { type: 'string' },
    numero: { type: 'string' },
    serie: { type: 'string' },
    dataEmissao: { type: 'string', format: 'date-time' },
    cnpjEmitente: { type: 'string' },
    razaoSocialEmitente: { type: 'string' },
    cnpjDestinatario: { type: 'string' },
    valorTotal: { type: 'string' },
    status: { type: 'string' },
    protocolo: { type: 'string' },
    fonte: { type: 'string' },
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

export function createDocumentRoutes(options: DocumentRouteOptions) {
  return async function (app: FastifyInstance) {
    app.get('/:chave', {
      schema: {
        tags: [options.label],
        summary: `Consulta ${options.label} por chave de acesso`,
        params: {
          type: 'object',
          required: ['chave'],
          properties: { chave: { type: 'string', minLength: 44, maxLength: 44 } },
        },
        response: {
          200: { type: 'object', properties: { sucesso: { type: 'boolean' }, dados: documentoSchema }, additionalProperties: true },
          400: { type: 'object', properties: { sucesso: { type: 'boolean' }, erro: { type: 'string' } } },
          404: { type: 'object', properties: { sucesso: { type: 'boolean' }, erro: { type: 'string' } } },
        },
      },
    }, async (request, reply) => {
      const { chave } = request.params as { chave: string };
      if (!/^\d{44}$/.test(chave)) {
        return reply.status(400).send({ sucesso: false, erro: 'Chave de acesso deve ter 44 dígitos numéricos' });
      }

      const tipoSDK = TIPO_PARA_SDK[options.tipo];
      if (!tipoSDK) {
        const resultado = await db
          .select()
          .from(documentos)
          .where(and(eq(documentos.chaveAcesso, chave), eq(documentos.tipo, options.tipo as any)))
          .limit(1);
        if (resultado.length === 0) {
          return reply.status(404).send({ sucesso: false, erro: `${options.label} não encontrado` });
        }
        return { sucesso: true, dados: resultado[0] };
      }

      const config = getSdkConfig();
      const resultado = await consultarComCache(chave, config);

      if (!resultado.sucesso) {
        return reply.status(404).send({ sucesso: false, erro: resultado.erro || `${options.label} não encontrado` });
      }

      return {
        sucesso: true,
        dados: { ...resultado.documento, tipo: options.tipo, fonte: resultado.fonte },
      };
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
        return reply.status(404).send({ sucesso: false, erro: 'XML não disponível' });
      }

      await salvarNoCache(resultado.documento);
      return reply.type('application/xml').send(resultado.documento.xml);
    });

    app.get('/', async (request, reply) => {
      const { cnpj, pagina = 1, limite = 20 } = request.query as any;
      if (!cnpj || !/^\d{14}$/.test(cnpj)) {
        return reply.status(400).send({ sucesso: false, erro: 'CNPJ deve ter 14 dígitos numéricos' });
      }
      const offset = (pagina - 1) * limite;
      const resultados = await db
        .select()
        .from(documentos)
        .where(and(eq(documentos.tipo, options.tipo as any), eq(documentos.cnpjEmitente, cnpj)))
        .limit(limite)
        .offset(offset);
      return { sucesso: true, dados: { documentos: resultados, total: resultados.length, pagina, limite } };
    });
  };
}
