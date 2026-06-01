import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from './lib/api';

const PROTECTED = ['/dashboard', '/empresa', '/relatorios', '/exportar', '/entradas', '/saidas'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/auth/entrar';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/dashboard/:path*', '/empresa/:path*', '/relatorios/:path*', '/exportar/:path*', '/entradas/:path*', '/saidas/:path*'],
};
