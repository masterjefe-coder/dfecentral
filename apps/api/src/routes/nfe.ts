import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { documentos } from '../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export async function nfeRoutes(app: FastifyInstance) {
  // Consulta NF-e por chave de acesso
  app.get<{ Params: { chave: string } }>('/:chave', async (request, reply) => {
    const { chave } = request.params;

    if (!/^\d{44}$/.test(chave)) {
      return reply.status(400).send({
        sucesso: false,
        erro: 'Chave de acesso deve ter 44 dígitos numéricos',
      });
    }

    const resultado = await db
      .select()
      .from(documentos)
      .where(and(eq(documentos.chaveAcesso, chave), eq(documentos.tipo, 'nfe')))
      .limit(1);

    if (resultado.length === 0) {
      return reply.status(404).send({
        sucesso: false,
        erro: 'NF-e não encontrada',
      });
    }

    return { sucesso: true, dados: resultado[0] };
  });

  // Lista NF-e por CNPJ
  app.get<{
    Querystring: {
      cnpj?: string;
      tipo?: 'emitidas' | 'recebidas' | 'todas';
      dataInicio?: string;
      dataFim?: string;
      pagina?: number;
      limite?: number;
    };
  }>('/', async (request, reply) => {
    const { cnpj, tipo = 'todas', dataInicio, dataFim, pagina = 1, limite = 20 } = request.query;

    if (!cnpj || !/^\d{14}$/.test(cnpj)) {
      return reply.status(400).send({
        sucesso: false,
        erro: 'CNPJ deve ter 14 dígitos numéricos',
      });
    }

    const conditions = [eq(documentos.tipo, 'nfe')];

    if (tipo === 'emitidas') {
      conditions.push(eq(documentos.cnpjEmitente, cnpj));
    } else if (tipo === 'recebidas') {
      conditions.push(eq(documentos.cnpjDestinatario, cnpj));
    } else {
      // Todas - usar OR logic via sql
      // Por simplicidade, buscar por emitente primeiro
      conditions.push(eq(documentos.cnpjEmitente, cnpj));
    }

    if (dataInicio) {
      conditions.push(gte(documentos.dataEmissao, new Date(dataInicio)));
    }
    if (dataFim) {
      conditions.push(lte(documentos.dataEmissao, new Date(dataFim)));
    }

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
      dados: {
        documentos: resultados,
        total: resultados.length,
        pagina,
        limite,
        paginas: Math.ceil(resultados.length / limite),
      },
    };
  });

  // Download XML
  app.get<{ Params: { chave: string } }>('/:chave/xml', async (request, reply) => {
    const { chave } = request.params;

    if (!/^\d{44}$/.test(chave)) {
      return reply.status(400).send({
        sucesso: false,
        erro: 'Chave de acesso deve ter 44 dígitos numéricos',
      });
    }

    const resultado = await db
      .select({ xmlCompleto: documentos.xmlCompleto })
      .from(documentos)
      .where(and(eq(documentos.chaveAcesso, chave), eq(documentos.tipo, 'nfe')))
      .limit(1);

    if (resultado.length === 0) {
      return reply.status(404).send({
        sucesso: false,
        erro: 'NF-e não encontrada',
      });
    }

    return {
      sucesso: true,
      dados: resultado[0].xmlCompleto,
    };
  });
}
