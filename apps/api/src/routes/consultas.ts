import type { FastifyInstance } from 'fastify';
import { listarConsultasRecentes } from '../db/audit.js';

export async function consultasRoutes(app: FastifyInstance) {
  app.get('/recentes', async (request, reply) => {
    const { cnpj, limite = 12 } = request.query as { cnpj?: string; limite?: string | number };
    const cnpjLimpo = String(cnpj || '').replace(/\D/g, '').slice(0, 14);
    const limiteNum = Math.min(50, Math.max(1, Number(limite) || 12));

    if (cnpj && !/^\d{14}$/.test(cnpjLimpo)) {
      return reply.status(400).send({ sucesso: false, erro: 'CNPJ invalido' });
    }

    const registros = await listarConsultasRecentes(cnpjLimpo || undefined, limiteNum);

    return {
      sucesso: true,
      dados: {
        consultas: registros.map((item) => ({
          id: item.id,
          tipo: item.tipo,
          consulta: item.consulta,
          resultado: item.resultado,
          ip: item.ip,
          criadoEm: item.criadoEm,
        })),
      },
    };
  });
}
