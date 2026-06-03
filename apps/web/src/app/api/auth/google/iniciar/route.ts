import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '../../../../../lib/api';

function publicApiBaseUrl(url: URL): string {
  const configured = process.env.API_PUBLIC_URL;
  if (configured) return configured;

  if (url.hostname.endsWith('dfecentral.com.br')) {
    const parts = url.hostname.split('.');
    if (parts.length >= 4 && parts[1] === 'dfecentral' && parts[2] === 'com') {
      parts[0] = 'api';
      return `${url.protocol}//${parts.join('.')}`;
    }
  }

  return getApiBaseUrl();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/dashboard';
  const callback = `${url.origin}/api/auth/google/callback?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(`${publicApiBaseUrl(url)}/api/v1/auth/google/iniciar?redirect=${encodeURIComponent(callback)}`);
}
