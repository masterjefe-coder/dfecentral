import type { NextRequest } from 'next/server';
import { getApiBaseUrl, getApiKey } from '../../../../../lib/api';

export async function POST(request: NextRequest) {
  const apiKey = getApiKey(request);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/billing/infinitepay/checkout`, {
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
