import { cookies } from 'next/headers';

/** Server-only helpers: the JWT lives in an httpOnly cookie and never reaches browser JavaScript. */

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const TOKEN_COOKIE = 'getnet_token';
const USER_COOKIE = 'getnet_user';

export type Role = 'merchant' | 'operator';

export interface Session {
  sub: string;
  role: Role;
}

/** Who is signed in, for routing the UI. The backend still authorizes every call with the token. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(USER_COOKIE)?.value;
  if (!raw || !store.get(TOKEN_COOKIE)) return null;
  try {
    const session = JSON.parse(raw) as Session;
    return session.sub && (session.role === 'merchant' || session.role === 'operator') ? session : null;
  } catch {
    return null;
  }
}

export async function setSession(token: string, session: Session, maxAgeSeconds: number): Promise<void> {
  const store = await cookies();
  const options = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: maxAgeSeconds };
  store.set(TOKEN_COOKIE, token, options);
  store.set(USER_COOKIE, JSON.stringify(session), options);
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
  store.delete(USER_COOKIE);
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
