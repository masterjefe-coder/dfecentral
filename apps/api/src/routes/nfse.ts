import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { documentos } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function nfseRoutes(app: FastifyInstance) {
  app.get<{ Params: { chave: string } }>('/:chave', async (request, reply) => {
    const { chave } = request.params;

    // NFS-e pode ter formatos diferentes de chave
    if (chave.length < 10) {
      return reply.status(400).send({
        sucesso: false,
        erro: 'Chave de acesso inválida',
      });
    }

    const resultado = await db
      .select()
      .from(documentos)
      .where(and(eq(documentos.chaveAcesso, chave), eq(documentos.tipo, 'nfse')))
      .limit(1);

    if (resultado.length === 0) {
      return reply.status(404).send({
        sucesso: false,
        erro: 'NFS-e não encontrada',
      });
    }

    return { sucesso: true, dados: resultado[0] };
  });

  app.get('/', async (request, reply) => {
    const { cnpj, pagina = 1, limite = 20 } = request.query as any;

    if (!cnpj || !/^\d{14}$/.test(cnpj)) {
      return reply.status(400).send({
        sucesso: false,
        erro: 'CNPJ deve ter 14 dígitos numéricos',
      });
    }

    const offset = (pagina - 1) * limite;

    const resultados = await db
      .select()
      .from(documentos)
      .where(and(eq(documentos.tipo, 'nfse'), eq(documentos.cnpjEmitente, cnpj)))
      .limit(limite)
      .offset(offset);

    return { sucesso: true, dados: { documentos: resultados, total: resultados.length, pagina, limite } };
  });
}
