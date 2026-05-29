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

async function proxy(request: NextRequest, pathSegments: string[]) {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const method = request.method || 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  if (body !== undefined) {
    const contentType = request.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;
  }

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/assistido/${pathSegments.join('/')}${request.nextUrl.search}`, {
    method,
    headers,
    body,
    cache: 'no-store',
  });

  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}
