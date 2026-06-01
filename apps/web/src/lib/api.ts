import type { NextRequest } from 'next/server';

export const SESSION_COOKIE = 'dfecentral_api_key';

export function getApiBaseUrl(): string {
  return process.env.API_BASE_URL || 'http://127.0.0.1:3004';
}

export function getApiKey(request?: NextRequest): string | null {
  const cookieKey = request?.cookies.get(SESSION_COOKIE)?.value?.trim();
  if (cookieKey) return cookieKey;

  const candidates = [process.env.API_KEY, process.env.API_KEYS, process.env.API_PROXY_KEY].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const key = candidate.split(',').map((value) => value.trim()).find(Boolean);
    if (key) return key;
  }

  return null;
}
