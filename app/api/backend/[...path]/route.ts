import { NextResponse } from 'next/server';
import { backendFetch, getSession } from '@/lib/session';

/**
 * Authenticated proxy to the backend. Only the routes the UI needs are forwarded (allowlist);
 * the bearer token is added on the server from the httpOnly cookie.
 */
const ALLOWED: Array<[method: 'GET' | 'POST', path: RegExp]> = [
  ['POST', /^chat$/],
  ['GET', /^conversations\/[0-9a-f-]{36}$/],
  ['GET', /^operator\/handoffs$/],
  ['GET', /^operator\/handoffs\/HND-[0-9A-F]{8}$/],
  ['POST', /^operator\/handoffs\/HND-[0-9A-F]{8}\/resolve$/],
  ['GET', /^operator\/conversations\/[0-9a-f-]{36}$/],
  ['GET', /^operator\/metrics$/],
];

type Context = { params: Promise<{ path: string[] }> };

async function proxy(method: 'GET' | 'POST', request: Request, { params }: Context) {
  const path = (await params).path.join('/');
  if (!ALLOWED.some(([m, re]) => m === method && re.test(path))) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!(await getSession())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const search = new URL(request.url).search;
  try {
    const res = await backendFetch(`/${path}${search}`, { method, ...(method === 'POST' ? { body: await request.text() } : {}) });
    const body = await res.json().catch(() => ({ error: 'invalid_backend_response' }));
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'api_unreachable', details: (err as Error).message }, { status: 502 });
  }
}

export const GET = (request: Request, context: Context) => proxy('GET', request, context);
export const POST = (request: Request, context: Context) => proxy('POST', request, context);
