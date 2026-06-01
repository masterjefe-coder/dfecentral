import type { NextRequest } from 'next/server';
import { getApiBaseUrl, getApiKey } from '../../../../lib/api';

export async function GET(request: NextRequest) {
  const apiKey = getApiKey(request);
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/relatorios/pdf?${request.nextUrl.searchParams.toString()}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/pdf',
      'Content-Disposition': upstream.headers.get('content-disposition') || 'inline',
      'Cache-Control': 'no-store',
    },
  });
}
