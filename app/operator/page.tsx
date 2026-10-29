import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { OperatorConsole } from '@/components/operator-console';
import { getSession } from '@/lib/session';

export default async function OperatorPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'operator') redirect('/');
  return (
    <main className="mx-auto flex h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <AppHeader user={session.sub} role={session.role} subtitle="Human queue — reply, approve or reject; the agent continues from where it stopped" />
      <OperatorConsole />
    </main>
  );
}
