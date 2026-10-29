import { NextResponse } from 'next/server';
import { clearSession, isSameOriginJson } from '@/lib/session';

export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await clearSession();
  return NextResponse.json({ ok: true });
}
