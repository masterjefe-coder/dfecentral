import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              versao: { type: 'string', example: '0.1.0' },
              uptime: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async () => ({
      status: 'ok',
      versao: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  );

  app.get(
    '/api/v1/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check (API v1)',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              versao: { type: 'string', example: '0.1.0' },
              uptime: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async () => ({
      status: 'ok',
      versao: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  );
}
