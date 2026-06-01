import type { NextRequest } from 'next/server';
import { getApiBaseUrl, getApiKey } from '../../../../lib/api';

async function proxy(request: NextRequest, method: 'GET' | 'PATCH') {
  const apiKey = getApiKey(request);
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (method === 'PATCH') headers['Content-Type'] = request.headers.get('content-type') || 'application/json';

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/empresas/ativa`, {
    method,
    headers,
    body: method === 'PATCH' ? await request.text() : undefined,
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

export async function GET(request: NextRequest) {
  return proxy(request, 'GET');
}

export async function PATCH(request: NextRequest) {
  return proxy(request, 'PATCH');
}
