import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '../../../../../lib/api';

function publicWebBaseUrl(url: URL): string {
  const configured = process.env.WEB_BASE_URL || process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');

  if (url.hostname.endsWith('dfecentral.com.br')) {
    return 'https://www.dfecentral.com.br';
  }

  return 'https://www.dfecentral.com.br';
}

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
    return 'https://api.dfecentral.com.br';
  }

  return 'https://api.dfecentral.com.br';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/dashboard';
  const callback = `${publicWebBaseUrl(url)}/api/auth/google/callback?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(`${publicApiBaseUrl(url)}/api/v1/auth/google/iniciar?redirect=${encodeURIComponent(callback)}`);
}
