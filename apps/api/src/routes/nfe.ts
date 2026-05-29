import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { documentos } from '../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

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
  },
};

export async function nfeRoutes(app: FastifyInstance) {
  app.get(
    '/:chave',
    {
      schema: {
        tags: ['NF-e'],
        summary: 'Consulta NF-e por chave de acesso',
        description: 'Busca uma NF-e específica pela chave de acesso de 44 dígitos.',
        params: {
          type: 'object',
          required: ['chave'],
          properties: {
            chave: { type: 'string', minLength: 44, maxLength: 44, description: 'Chave de acesso de 44 dígitos' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              sucesso: { type: 'boolean', example: true },
              dados: documentoSchema,
            },
          },
          400: { type: 'object', properties: { sucesso: { type: 'boolean', example: false }, erro: { type: 'string' } } },
          404: { type: 'object', properties: { sucesso: { type: 'boolean', example: false }, erro: { type: 'string' } } },
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
        .where(and(eq(documentos.chaveAcesso, chave), eq(documentos.tipo, 'nfe')))
        .limit(1);

      if (resultado.length === 0) {
        return reply.status(404).send({ sucesso: false, erro: 'NF-e não encontrada' });
      }

      return { sucesso: true, dados: resultado[0] };
    }
  );

  app.get(
    '/',
    {
      schema: {
        tags: ['NF-e'],
        summary: 'Lista NF-e por CNPJ',
        description: 'Lista todas as NF-e associadas a um CNPJ (emitidas, recebidas ou todas).',
        querystring: {
          type: 'object',
          required: ['cnpj'],
          properties: {
            cnpj: { type: 'string', minLength: 14, maxLength: 14, description: 'CNPJ do emitente ou destinatário' },
            tipo: { type: 'string', enum: ['emitidas', 'recebidas', 'todas'], default: 'todas' },
            dataInicio: { type: 'string', format: 'date', description: 'Data início (AAAA-MM-DD)' },
            dataFim: { type: 'string', format: 'date', description: 'Data fim (AAAA-MM-DD)' },
            pagina: { type: 'integer', default: 1, minimum: 1 },
            limite: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              sucesso: { type: 'boolean', example: true },
              dados: {
                type: 'object',
                properties: {
                  documentos: { type: 'array', items: documentoSchema },
                  total: { type: 'integer' },
                  pagina: { type: 'integer' },
                  limite: { type: 'integer' },
                  paginas: { type: 'integer' },
                },
              },
            },
          },
          400: { type: 'object', properties: { sucesso: { type: 'boolean', example: false }, erro: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
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

      return {
        sucesso: true,
        dados: { documentos: resultados, total: resultados.length, pagina, limite, paginas: Math.ceil(resultados.length / limite) },
      };
    }
  );

  app.get(
    '/:chave/xml',
    {
      schema: {
        tags: ['NF-e'],
        summary: 'Download XML da NF-e',
        description: 'Retorna o XML completo de uma NF-e autorizada.',
        params: {
          type: 'object',
          required: ['chave'],
          properties: {
            chave: { type: 'string', minLength: 44, maxLength: 44 },
          },
        },
        response: {
          200: { type: 'object', properties: { sucesso: { type: 'boolean', example: true }, dados: { type: 'object' } } },
          404: { type: 'object', properties: { sucesso: { type: 'boolean', example: false }, erro: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const { chave } = request.params as { chave: string };

      if (!/^\d{44}$/.test(chave)) {
        return reply.status(400).send({ sucesso: false, erro: 'Chave de acesso deve ter 44 dígitos numéricos' });
      }

      const resultado = await db
        .select({ xmlCompleto: documentos.xmlCompleto })
        .from(documentos)
        .where(and(eq(documentos.chaveAcesso, chave), eq(documentos.tipo, 'nfe')))
        .limit(1);

      if (resultado.length === 0) {
        return reply.status(404).send({ sucesso: false, erro: 'NF-e não encontrada' });
      }

      return { sucesso: true, dados: resultado[0].xmlCompleto };
    }
  );
}
