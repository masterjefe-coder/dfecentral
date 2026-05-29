import type { FastifyInstance } from 'fastify';

const SEFAZ_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export async function sefazRoutes(app: FastifyInstance) {
  app.get(
    '/status',
    {
      schema: {
        tags: ['SEFAZ'],
        summary: 'Status de todas as SEFAZs',
        response: {
          200: {
            type: 'object',
            properties: {
              sucesso: { type: 'boolean' },
              dados: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    uf: { type: 'string', example: 'SP' },
                    status: { type: 'string', enum: ['online', 'offline', 'manutencao'] },
                    ultimoCheck: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => ({
      sucesso: true,
      dados: SEFAZ_UFS.map((uf) => ({ uf, status: 'online' as const, ultimoCheck: new Date().toISOString() })),
    })
  );

  app.get(
    '/status/:uf',
    {
      schema: {
        tags: ['SEFAZ'],
        summary: 'Status de uma SEFAZ específica',
        params: {
          type: 'object',
          required: ['uf'],
          properties: {
            uf: { type: 'string', minLength: 2, maxLength: 2, description: 'UF (ex: SP, RJ)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              sucesso: { type: 'boolean' },
              dados: { type: 'object', properties: { uf: { type: 'string' }, status: { type: 'string' }, ultimoCheck: { type: 'string' } } },
            },
          },
          400: { type: 'object', properties: { sucesso: { type: 'boolean' }, erro: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const { uf } = request.params as { uf: string };
      const ufUpper = uf.toUpperCase();
      if (!SEFAZ_UFS.includes(ufUpper)) {
        return reply.status(400).send({ sucesso: false, erro: `UF inválida: ${uf}` });
      }
      return { sucesso: true, dados: { uf: ufUpper, status: 'online', ultimoCheck: new Date().toISOString() } };
    }
  );
}
