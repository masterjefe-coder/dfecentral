import type { FastifyInstance } from 'fastify';

const SEFAZ_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export async function sefazRoutes(app: FastifyInstance) {
  // Status de todas as SEFAZs
  app.get('/status', async () => {
    const status = SEFAZ_UFS.map((uf) => ({
      uf,
      status: 'online' as const,
      ultimoCheck: new Date().toISOString(),
    }));

    return {
      sucesso: true,
      dados: status,
    };
  });

  // Status de uma SEFAZ específica
  app.get<{ Params: { uf: string } }>('/status/:uf', async (request, reply) => {
    const { uf } = request.params;
    const ufUpper = uf.toUpperCase();

    if (!SEFAZ_UFS.includes(ufUpper)) {
      return reply.status(400).send({
        sucesso: false,
        erro: `UF inválida: ${uf}. UFs válidas: ${SEFAZ_UFS.join(', ')}`,
      });
    }

    return {
      sucesso: true,
      dados: {
        uf: ufUpper,
        status: 'online',
        ultimoCheck: new Date().toISOString(),
      },
    };
  });
}
