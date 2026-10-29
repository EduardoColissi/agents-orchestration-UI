import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { getSession } from '@/lib/session';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === 'operator' ? '/operator' : '/');
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-6">
      <LoginForm />
    </main>
  );
}
