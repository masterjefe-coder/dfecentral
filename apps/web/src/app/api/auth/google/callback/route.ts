import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../../lib/api';

function publicWebBaseUrl(url: URL): string {
  const configured = process.env.WEB_BASE_URL || process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');

  if (url.hostname.endsWith('dfecentral.com.br')) {
    return 'https://www.dfecentral.com.br';
  }

  return 'https://www.dfecentral.com.br';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const apiKey = url.searchParams.get('apiKey');
  const next = url.searchParams.get('next') || '/dashboard';
  let destinoFinal = next;
  try {
    const parsed = new URL(next, publicWebBaseUrl(url));
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      destinoFinal = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/dashboard';
    }
  } catch {
    destinoFinal = next;
  }

  if (!apiKey) {
    return NextResponse.redirect(new URL('/auth/entrar?erro=google', publicWebBaseUrl(url)));
  }

  const response = NextResponse.redirect(new URL(destinoFinal, publicWebBaseUrl(url)));
  response.cookies.set(SESSION_COOKIE, apiKey, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
