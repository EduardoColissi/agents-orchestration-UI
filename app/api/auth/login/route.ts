import { NextResponse } from 'next/server';
import { API_URL, setSession, type Role } from '@/lib/session';

/** Exchanges demo credentials for a JWT at the backend and keeps it in an httpOnly cookie. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  if (!body?.username || !body.password) return NextResponse.json({ error: 'invalid_request', details: 'username and password are required' }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: body.username, password: body.password }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch (err) {
    return NextResponse.json({ error: 'api_unreachable', details: `Could not reach ${API_URL}: ${(err as Error).message}` }, { status: 502 });
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number; sub?: string; role?: Role; error?: string };
  if (!res.ok || !data.access_token || !data.sub || !data.role) return NextResponse.json({ error: data.error ?? 'login_failed' }, { status: res.status === 200 ? 502 : res.status });

  await setSession(data.access_token, { sub: data.sub, role: data.role }, data.expires_in ?? 3600);
  return NextResponse.json({ sub: data.sub, role: data.role });
}
