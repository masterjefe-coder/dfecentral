import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '../../../../lib/api';

export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/auth/esqueci-senha`, {
    method: 'POST',
    headers: { 'Content-Type': request.headers.get('content-type') || 'application/json' },
    body,
    cache: 'no-store',
  });

  return NextResponse.json(await upstream.json(), { status: upstream.status });
}
