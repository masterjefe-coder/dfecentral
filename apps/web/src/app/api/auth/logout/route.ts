import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/api';

export async function POST() {
  const response = NextResponse.json({ sucesso: true });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
