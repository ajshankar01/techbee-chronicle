import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route protection middleware.
 * Candidates cannot access /hr/* routes.
 * HR cannot be re-directed to /candidate/* routes.
 * Full auth validation happens client-side via Teams SSO token.
 */
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/hr/:path*', '/interview/:path*'],
};
