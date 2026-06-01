import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../../lib/api';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const apiKey = url.searchParams.get('apiKey');
  const next = url.searchParams.get('next') || '/dashboard';

  if (!apiKey) {
    return NextResponse.redirect(new URL('/auth/entrar?erro=google', url.origin));
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.set(SESSION_COOKIE, apiKey, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
