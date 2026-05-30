import type { NextRequest } from 'next/server';

function getApiBaseUrl(): string {
  return process.env.API_BASE_URL || 'http://127.0.0.1:3004';
}

function getApiKey(): string | null {
  const candidates = [process.env.API_KEY, process.env.API_KEYS, process.env.API_PROXY_KEY].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const key = candidate.split(',').map((value) => value.trim()).find(Boolean);
    if (key) return key;
  }
  return null;
}

async function proxy(request: NextRequest, tipo: string) {
  const apiKey = getApiKey();
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
