'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, DEMO_USERS } from '@/lib/api';

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('cliente1988');
  const [password, setPassword] = useState('demo-cliente1988');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(user: string, pass: string) {
    setPending(true);
    setError(null);
    try {
      const session = await api.login(user, pass);
      router.replace(session.role === 'operator' ? '/operator' : '/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message === 'invalid_credentials' ? 'Wrong username or password.' : (err as Error).message);
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm gap-5 p-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-xl">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Getnet Support</h1>
          <p className="text-muted-foreground text-xs">Sign in as a merchant or as an operator</p>
        </div>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(username, password);
        }}
      >
        <label className="flex flex-col gap-1 text-xs">
          Username
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="font-mono" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Password
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="font-mono" />
        </label>
        {error && <p className="text-destructive text-xs">{error}</p>}
        <Button type="submit" disabled={pending || !username || !password}>
          {pending ? <Loader2 className="animate-spin" /> : <LogIn />} Sign in
        </Button>
      </form>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">Demo users (password = <code>demo-&lt;username&gt;</code>)</p>
        <div className="flex flex-col gap-1.5">
          {DEMO_USERS.map((u) => (
            <Button key={u.username} variant="outline" size="sm" className="h-auto justify-between gap-2 py-1.5 text-xs" disabled={pending} onClick={() => signIn(u.username, `demo-${u.username}`)}>
              <span className="font-mono">{u.username}</span>
              <span className="text-muted-foreground truncate">{u.note}</span>
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
