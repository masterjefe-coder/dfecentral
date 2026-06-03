import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { timingSafeEqual } from 'node:crypto';
import { nfeRoutes } from './routes/nfe.js';
import { cteRoutes } from './routes/cte.js';
import { bpeRoutes } from './routes/bpe.js';
import { cteosRoutes } from './routes/cteos.js';
import { mdfeRoutes } from './routes/mdfe.js';
import { nfseRoutes } from './routes/nfse.js';
import { nfceRoutes } from './routes/nfce.js';
import { dceRoutes } from './routes/dce.js';
import { healthRoutes } from './routes/health.js';
import { sefazRoutes } from './routes/sefaz.js';
import { importacoesRoutes } from './routes/importacoes.js';
import { consultasRoutes } from './routes/consultas.js';
import { contaRoutes } from './routes/conta.js';
import { billingRoutes } from './routes/billing.js';
import { equipeRoutes } from './routes/equipe.js';
import { contabilidadeRoutes } from './routes/contabilidade.js';
import { authRoutes } from './routes/auth.js';
import { relatoriosRoutes } from './routes/relatorios.js';
import { empresasRoutes } from './routes/empresas.js';
import { certificadosRoutes } from './routes/certificados.js';
import { obterContaPorApiKey } from './db/account.js';
import { processarCobrancasAssinaturaVencidas } from './services/assinaturas.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

function getConfiguredApiKeys(): string[] {
  const candidates = [process.env.API_KEY, process.env.API_KEYS].filter(Boolean) as string[];
  return candidates
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function matchesKey(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

function extractAuthToken(authorization?: string, apiKey?: string): string | null {
  const headerValue = authorization || apiKey || '';
  if (!headerValue) return null;
  const bearerMatch = headerValue.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1].trim();
  return headerValue.trim();
}

app.addHook('onRequest', async (request, reply) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const isPublicRoute =
      pathname === '/health' ||
      pathname === '/api/v1/health' ||
      pathname.startsWith('/docs') ||
      pathname.startsWith('/api/v1/auth') ||
      pathname.startsWith('/api/v1/billing/recebeaqui/webhook');

  if (isPublicRoute) return;

  const configuredKeys = getConfiguredApiKeys();
  if (configuredKeys.length === 0) return;

  const token = extractAuthToken(
    request.headers.authorization,
    request.headers['x-api-key']?.toString(),
  );

  if (!token || !configuredKeys.some((key) => matchesKey(key, token))) {
    return reply.status(401).send({
      sucesso: false,
      erro: 'Autenticacao requerida. Envie Authorization: Bearer <token> ou X-API-Key.',
    });
  }

  const conta = await obterContaPorApiKey(token);
  (request as any).conta = conta;

  if (pathname !== '/api/v1/conta' && pathname !== '/api/v1/conta/') {
    if (conta && conta.limiteMensal !== null && conta.usoMensal >= conta.limiteMensal) {
      return reply.status(429).send({
        sucesso: false,
        erro: 'Limite mensal do plano atingido',
        plano: conta.plano,
        usoMensal: conta.usoMensal,
        limiteMensal: conta.limiteMensal,
      });
    }
  }
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

await app.register(swagger, {
  openapi: {
    info: {
      title: 'DFeCentral API',
      description: 'API REST para consulta de documentos fiscais eletrÃ´nicos brasileiros',
      version: '0.1.0',
      contact: { name: 'DFeCentral', url: 'https://www.dfecentral.com.br' },
    },
    security: [{ BearerAuth: [] }],
    servers: [
      { url: 'https://api.dfecentral.com.br', description: 'ProduÃ§Ã£o' },
      { url: 'http://localhost:3004', description: 'Desenvolvimento' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'API Key' },
      },
    },
  },
});

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'list', deepLinking: true },
});

// Rotas
await app.register(healthRoutes);
  await app.register(nfeRoutes, { prefix: '/api/v1/nfe' });
  await app.register(nfceRoutes, { prefix: '/api/v1/nfce' });
  await app.register(nfseRoutes, { prefix: '/api/v1/nfse' });
  await app.register(bpeRoutes, { prefix: '/api/v1/bpe' });
  await app.register(cteRoutes, { prefix: '/api/v1/cte' });
  await app.register(cteosRoutes, { prefix: '/api/v1/cteos' });
  await app.register(mdfeRoutes, { prefix: '/api/v1/mdfe' });
  await app.register(dceRoutes, { prefix: '/api/v1/dce' });
await app.register(sefazRoutes, { prefix: '/api/v1/sefaz' });
await app.register(importacoesRoutes, { prefix: '/api/v1/importacoes' });
await app.register(consultasRoutes, { prefix: '/api/v1/consultas' });
await app.register(contaRoutes, { prefix: '/api/v1/conta' });
await app.register(billingRoutes, { prefix: '/api/v1/billing' });
await app.register(equipeRoutes, { prefix: '/api/v1/equipe' });
await app.register(contabilidadeRoutes, { prefix: '/api/v1/contabilidade' });
await app.register(authRoutes, { prefix: '/api/v1/auth' });
await app.register(relatoriosRoutes, { prefix: '/api/v1/relatorios' });
await app.register(empresasRoutes, { prefix: '/api/v1/empresas' });
await app.register(certificadosRoutes, { prefix: '/api/v1/certificados' });

const cobrancasTimer = setInterval(() => {
  void processarCobrancasAssinaturaVencidas(app.log);
}, 60 * 60 * 1000);
(cobrancasTimer as any).unref?.();
void processarCobrancasAssinaturaVencidas(app.log);

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
