import type { NextRequest } from 'next/server';
import { getApiBaseUrl, getApiKey } from '../../../../lib/api';

export async function POST(request: NextRequest) {
  const apiKey = getApiKey(request);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/contabilidade/pacote-mensal/arquivo`, {
    method: 'POST',
    headers,
    body: await request.text(),
    cache: 'no-store',
  });

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/zip',
      'Content-Disposition': upstream.headers.get('content-disposition') || 'attachment; filename="xmls.zip"',
      'Cache-Control': 'no-store',
    },
  });
}
