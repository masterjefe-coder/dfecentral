import type { NextRequest } from 'next/server';

const ALLOWED_TYPES = new Set(['nfe', 'nfce', 'nfse', 'cte', 'mdfe', 'dce']);

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

async function proxyXml(tipo: string, chave: string) {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/${tipo}/${chave}/xml`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const contentType = upstream.headers.get('content-type') || 'application/xml; charset=utf-8';
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': contentType },
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ tipo: string; chave: string }> }) {
  const { tipo, chave } = await context.params;
  if (!ALLOWED_TYPES.has(tipo)) {
    return Response.json({ sucesso: false, erro: 'Tipo de documento invalido' }, { status: 400 });
  }

  return proxyXml(tipo, chave);
}
