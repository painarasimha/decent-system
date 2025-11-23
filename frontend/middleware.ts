import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Public paths that don't require authentication
  const publicPaths = ['/', '/login'];
  const path = request.nextUrl.pathname;

  // Check if current path is public
  if (publicPaths.includes(path)) {
    return NextResponse.next();
  }

  // For protected routes, we'll check auth on client side
  // since we're using localStorage for token storage
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};