import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '../../../../../lib/api';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/dashboard';
  const callback = `${url.origin}/api/auth/google/callback?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(`${getApiBaseUrl()}/api/v1/auth/google/iniciar?redirect=${encodeURIComponent(callback)}`);
}
