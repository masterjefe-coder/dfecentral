import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../../lib/api';

function publicWebBaseUrl(url: URL): string {
  const configured = process.env.WEB_BASE_URL || process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');

  if (url.hostname.endsWith('dfecentral.com.br')) {
    const parts = url.hostname.split('.');
    if (parts.length >= 4 && parts[1] === 'dfecentral' && parts[2] === 'com') {
      parts[0] = 'www';
      return `${url.protocol}//${parts.join('.')}`;
    }
  }

  return process.env.NODE_ENV === 'production' ? 'https://www.dfecentral.com.br' : url.origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const apiKey = url.searchParams.get('apiKey');
  const next = url.searchParams.get('next') || '/dashboard';

  if (!apiKey) {
    return NextResponse.redirect(new URL('/auth/entrar?erro=google', publicWebBaseUrl(url)));
  }

  const response = NextResponse.redirect(new URL(next, publicWebBaseUrl(url)));
  response.cookies.set(SESSION_COOKIE, apiKey, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
