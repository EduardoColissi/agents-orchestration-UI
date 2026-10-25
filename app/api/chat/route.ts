import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

/** Server-side proxy: avoids CORS and keeps the API address out of the browser. */
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: 'invalid_request', details: 'body must be JSON' }, { status: 400 });

  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'api_unreachable', details: `Could not reach ${API_URL}: ${(err as Error).message}` }, { status: 502 });
  }
}
