import type { FastifyInstance } from 'fastify';
import { obterContaPorApiKey } from '../db/account.js';

function extrairToken(authorization?: string, apiKey?: string): string | null {
  const headerValue = authorization || apiKey || '';
  if (!headerValue) return null;
  const bearerMatch = headerValue.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1].trim();
  return headerValue.trim();
}

export async function contaRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) {
      return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });
    }

    const conta = await obterContaPorApiKey(token);
    if (!conta) {
      return {
        sucesso: true,
        dados: {
          vinculada: false,
        },
      };
    }

    return {
      sucesso: true,
      dados: {
        vinculada: true,
        ...conta,
      },
    };
  });
}
