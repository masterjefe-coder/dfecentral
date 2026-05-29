import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return {
      status: 'ok',
      versao: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      versao: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });
}
