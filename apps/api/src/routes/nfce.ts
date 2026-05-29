import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { documentos } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function nfceRoutes(app: FastifyInstance) {
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
      .where(and(eq(documentos.chaveAcesso, chave), eq(documentos.tipo, 'nfce')))
      .limit(1);

    if (resultado.length === 0) {
      return reply.status(404).send({
        sucesso: false,
        erro: 'NFC-e não encontrada',
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
      .where(and(eq(documentos.tipo, 'nfce'), eq(documentos.cnpjEmitente, cnpj)))
      .limit(limite)
      .offset(offset);

    return { sucesso: true, dados: { documentos: resultados, total: resultados.length, pagina, limite } };
  });
}
