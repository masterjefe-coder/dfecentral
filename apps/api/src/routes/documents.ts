import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { documentos } from '../db/schema';
import { eq, and } from 'drizzle-orm';

interface DocumentRouteOptions {
  tipo: string;
  label: string;
}

const documentoSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
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
  },
};

export function createDocumentRoutes(options: DocumentRouteOptions) {
  return async function (app: FastifyInstance) {
    app.get(
      '/:chave',
      {
        schema: {
          tags: [options.label],
          summary: `Consulta ${options.label} por chave de acesso`,
          params: {
            type: 'object',
            required: ['chave'],
            properties: {
              chave: { type: 'string', minLength: 44, maxLength: 44 },
            },
          },
          response: {
            200: { type: 'object', properties: { sucesso: { type: 'boolean' }, dados: documentoSchema } },
            400: { type: 'object', properties: { sucesso: { type: 'boolean' }, erro: { type: 'string' } } },
            404: { type: 'object', properties: { sucesso: { type: 'boolean' }, erro: { type: 'string' } } },
          },
        },
      },
      async (request, reply) => {
        const { chave } = request.params as { chave: string };
        if (!/^\d{44}$/.test(chave)) {
          return reply.status(400).send({ sucesso: false, erro: 'Chave de acesso deve ter 44 dígitos numéricos' });
        }
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
    );

    app.get(
      '/',
      {
        schema: {
          tags: [options.label],
          summary: `Lista ${options.label} por CNPJ`,
          querystring: {
            type: 'object',
            required: ['cnpj'],
            properties: {
              cnpj: { type: 'string', minLength: 14, maxLength: 14 },
              pagina: { type: 'integer', default: 1 },
              limite: { type: 'integer', default: 20 },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                sucesso: { type: 'boolean' },
                dados: {
                  type: 'object',
                  properties: {
                    documentos: { type: 'array', items: documentoSchema },
                    total: { type: 'integer' },
                    pagina: { type: 'integer' },
                    limite: { type: 'integer' },
                  },
                },
              },
            },
            400: { type: 'object', properties: { sucesso: { type: 'boolean' }, erro: { type: 'string' } } },
          },
        },
      },
      async (request, reply) => {
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
        return {
          sucesso: true,
          dados: { documentos: resultados, total: resultados.length, pagina, limite },
        };
      }
    );
  };
}
