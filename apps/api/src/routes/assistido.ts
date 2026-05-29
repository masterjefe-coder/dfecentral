import type { FastifyInstance } from 'fastify';

function getScraperUrl(): string | null {
  const value = process.env.SCRAPER_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

async function proxyToScraper(path: string, method: string, body?: unknown) {
  const baseUrl = getScraperUrl();
  if (!baseUrl) {
    return {
      status: 503,
      payload: { sucesso: false, erro: 'SCRAPER_URL nao configurado' },
      contentType: 'application/json; charset=utf-8',
    };
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || 'application/json; charset=utf-8';
  if (contentType.includes('application/json')) {
    return {
      status: response.status,
      payload: await response.text(),
      contentType,
    };
  }

  return {
    status: response.status,
    payload: await response.arrayBuffer(),
    contentType,
  };
}

async function sendProxyResponse(reply: any, result: Awaited<ReturnType<typeof proxyToScraper>>) {
  if (typeof result.payload === 'string') {
    return reply.status(result.status).header('content-type', result.contentType).send(result.payload);
  }
  if (result.payload instanceof ArrayBuffer) {
    return reply.status(result.status).header('content-type', result.contentType).send(Buffer.from(result.payload));
  }
  return reply.status(result.status).header('content-type', result.contentType).send(result.payload);
}

export async function assistidoRoutes(app: FastifyInstance) {
  app.post('/start', async (request, reply) => {
    const result = await proxyToScraper('/assist/start', 'POST', request.body);
    return sendProxyResponse(reply, result);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await proxyToScraper(`/assist/${id}`, 'GET');
    return sendProxyResponse(reply, result);
  });

  app.get('/:id/state', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await proxyToScraper(`/assist/${id}/state`, 'GET');
    return sendProxyResponse(reply, result);
  });

  app.get('/:id/frame', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await proxyToScraper(`/assist/${id}/frame`, 'GET');
    return sendProxyResponse(reply, result);
  });

  app.post('/:id/action', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await proxyToScraper(`/assist/${id}/action`, 'POST', request.body);
    return sendProxyResponse(reply, result);
  });

  app.post('/:id/finalizar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await proxyToScraper(`/assist/${id}/finalizar`, 'POST', request.body);
    return sendProxyResponse(reply, result);
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await proxyToScraper(`/assist/${id}`, 'DELETE');
    return sendProxyResponse(reply, result);
  });
}
