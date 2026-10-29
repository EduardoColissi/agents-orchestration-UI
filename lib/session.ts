import { cookies } from 'next/headers';

/** Server-only helpers: the JWT lives in an httpOnly cookie and never reaches browser JavaScript. */

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const TOKEN_COOKIE = 'getnet_token';

export type Role = 'merchant' | 'operator';

export interface Session {
  sub: string;
  role: Role;
}

/**
 * Who is signed in, read from the token's claims (not verified here: this only routes the UI;
 * the backend verifies the signature on every call). Expired tokens count as signed out.
 */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { sub?: unknown; role?: unknown; exp?: unknown };
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null;
    return typeof claims.sub === 'string' && (claims.role === 'merchant' || claims.role === 'operator') ? { sub: claims.sub, role: claims.role } : null;
  } catch {
    return null;
  }
}

export async function setSession(token: string, maxAgeSeconds: number): Promise<void> {
  (await cookies()).set(TOKEN_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: maxAgeSeconds });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(TOKEN_COOKIE);
}

/**
 * CSRF guard for state-changing routes: SameSite=Lax still lets a top-level cross-site form POST
 * through (and same-site pages on other ports), so POSTs must come from this origin with JSON.
 */
export function isSameOriginJson(request: Request): boolean {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  const contentType = request.headers.get('content-type') ?? '';
  const sameOrigin = origin ? origin === new URL(request.url).origin : fetchSite === null || fetchSite === 'same-origin';
  return sameOrigin && (fetchSite === null || fetchSite === 'same-origin') && contentType.startsWith('application/json');
}

/** Calls the backend with the session's bearer token. An expired or invalid token ends the session. */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    // Local models on CPU can take a minute per turn.
    signal: AbortSignal.timeout(300_000),
    cache: 'no-store',
  });
  if (res.status === 401) await clearSession();
  return res;
}
