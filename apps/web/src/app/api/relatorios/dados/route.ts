import type { NextRequest } from 'next/server';
import { getApiBaseUrl, getApiKey } from '../../../../lib/api';

export async function GET(request: NextRequest) {
  const apiKey = getApiKey(request);
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/relatorios/dados?${request.nextUrl.searchParams.toString()}`, {
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
