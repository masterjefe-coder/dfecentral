import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '../../../../../lib/api';

function publicApiBaseUrl(url: URL): string {
  const configured = process.env.API_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const webBase = process.env.WEB_BASE_URL || process.env.APP_BASE_URL;
  if (webBase) {
    try {
      const base = new URL(webBase);
      if (base.hostname.endsWith('dfecentral.com.br')) {
        base.hostname = base.hostname.startsWith('www.') ? base.hostname.replace(/^www\./, 'api.') : 'api.dfecentral.com.br';
      }
      return base.origin;
    } catch {
      // Mantem os fallbacks abaixo.
    }
  }

  if (url.hostname.endsWith('dfecentral.com.br')) {
    const parts = url.hostname.split('.');
    if (parts.length >= 4 && parts[1] === 'dfecentral' && parts[2] === 'com') {
      parts[0] = 'api';
      return `${url.protocol}//${parts.join('.')}`;
    }
  }

  return process.env.NODE_ENV === 'production' ? 'https://api.dfecentral.com.br' : getApiBaseUrl();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/dashboard';
  const callback = `${url.origin}/api/auth/google/callback?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(`${publicApiBaseUrl(url)}/api/v1/auth/google/iniciar?redirect=${encodeURIComponent(callback)}`);
}
