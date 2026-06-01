import { NextResponse } from 'next/server';
import { getApiBaseUrl, SESSION_COOKIE } from '../../../../lib/api';

export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/auth/registrar`, {
    method: 'POST',
    headers: { 'Content-Type': request.headers.get('content-type') || 'application/json' },
    body,
    cache: 'no-store',
  });

  const payload = await upstream.json();
  const response = NextResponse.json(payload, { status: upstream.status });
  if (upstream.ok && payload?.dados?.usuario?.apiKey) {
    response.cookies.set(SESSION_COOKIE, payload.dados.usuario.apiKey, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
