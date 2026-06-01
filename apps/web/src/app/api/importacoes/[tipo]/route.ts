import type { NextRequest } from 'next/server';
import { getApiBaseUrl, getApiKey } from '../../../../lib/api';

async function proxy(request: NextRequest, tipo: string) {
  const apiKey = getApiKey(request);
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  headers['Content-Type'] = request.headers.get('content-type') || 'application/json';

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/importacoes/${tipo}`, {
    method: 'POST',
    headers,
    body: await request.text(),
    cache: 'no-store',
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await context.params;
  return proxy(request, tipo);
}
