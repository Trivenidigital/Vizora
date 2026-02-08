import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Pages that don't require authentication
const publicPaths = ['/login', '/register', '/'];

function base64UrlDecode(str: string): string {
  // Convert Base64url to standard Base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

// Format-only check: verifies the token looks like a JWT (3 base64url parts with valid JSON payload).
// This does NOT verify the signature — real validation happens server-side in the middleware API.
function isValidJwtFormat(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    JSON.parse(base64UrlDecode(parts[1]));
    return true;
  } catch {
    return false;
  }
}

// Decode JWT payload without signature verification.
// Returns the parsed payload object, or null if decoding fails.
// This is defense-in-depth — actual auth verification happens at the API level.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

// Check if the decoded JWT payload indicates a super admin user.
// Checks for either `isSuperAdmin: true` or `role: 'superadmin'` in the payload.
function isSuperAdminFromPayload(payload: Record<string, unknown>): boolean {
  if (payload.isSuperAdmin === true) return true;
  if (payload.role === 'superadmin') return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname === path || pathname.startsWith('/_next'))) {
    return NextResponse.next();
  }

  // Check for auth token in cookies (httpOnly cookie set by backend)
  // Cookie name must match AUTH_CONSTANTS.COOKIE_NAME from middleware
  const tokenFromCookie = request.cookies.get('vizora_auth_token')?.value;
  const tokenFromHeader = request.headers.get('authorization')?.replace('Bearer ', '');
  const token = tokenFromCookie || tokenFromHeader;

  // Redirect to login if no valid token and trying to access protected route
  if ((!token || !isValidJwtFormat(token)) && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin'))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Defense-in-depth: block non-superadmin users from accessing /admin routes.
  // This decodes the JWT payload (without signature verification) to check for
  // superadmin privileges. Actual auth verification happens at the API level.
  if (token && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    const payload = decodeJwtPayload(token);
    if (!payload || !isSuperAdminFromPayload(payload)) {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
