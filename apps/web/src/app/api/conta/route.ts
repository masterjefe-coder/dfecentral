import type { NextRequest } from 'next/server';
import { getApiBaseUrl, getApiKey } from '../../../lib/api';

async function proxy(request: NextRequest) {
  const apiKey = getApiKey(request);
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/conta`, {
    method: 'GET',
    headers,
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
  return proxy(request);
}
