import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { nfeRoutes } from './routes/nfe';
import { cteRoutes } from './routes/cte';
import { mdfeRoutes } from './routes/mdfe';
import { nfseRoutes } from './routes/nfse';
import { nfceRoutes } from './routes/nfce';
import { dceRoutes } from './routes/dce';
import { healthRoutes } from './routes/health';
import { sefazRoutes } from './routes/sefaz';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

// Plugins
await app.register(cors, {
  origin: (process.env.API_CORS_ORIGIN || '').split(',').filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Rotas
await app.register(healthRoutes);
await app.register(nfeRoutes, { prefix: '/api/v1/nfe' });
await app.register(nfceRoutes, { prefix: '/api/v1/nfce' });
await app.register(nfseRoutes, { prefix: '/api/v1/nfse' });
await app.register(cteRoutes, { prefix: '/api/v1/cte' });
await app.register(mdfeRoutes, { prefix: '/api/v1/mdfe' });
await app.register(dceRoutes, { prefix: '/api/v1/dce' });
await app.register(sefazRoutes, { prefix: '/api/v1/sefaz' });

// Start
const port = Number(process.env.API_PORT || 3004);
const host = process.env.API_HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`DFeCentral API rodando em http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
