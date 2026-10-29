import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { Chat } from '@/components/chat';
import { getSession } from '@/lib/session';

export default async function Home() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'operator') redirect('/operator');
  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <AppHeader user={session.sub} role={session.role} subtitle="Router · Knowledge · Support · Escalation — with memory and a human queue" />
      <Chat user={session.sub} />
    </main>
  );
}
