import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/api';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value?.trim();
  if (!token) {
    return new Response(JSON.stringify({ sucesso: false }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(JSON.stringify({ sucesso: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
