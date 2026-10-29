'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Headset, LogOut, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, type Role } from '@/lib/api';

export function AppHeader({ user, role, subtitle }: { user: string; role: Role; subtitle: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    try {
      await api.logout();
      router.replace('/login');
      router.refresh();
    } catch (err) {
      setError(`Sign out failed: ${(err as Error).message}`);
    }
  }

  return (
    <header className="flex flex-wrap items-center gap-3">
      <div className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-xl">
        {role === 'operator' ? <Headset className="size-5" /> : <Sparkles className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold tracking-tight">
          <Link href="/">Getnet Support</Link>
        </h1>
        <p className="text-muted-foreground text-xs">{subtitle}</p>
      </div>
      <Badge variant="secondary" className="font-mono">
        {user} · {role}
      </Badge>
      <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
        <LogOut /> Sign out
      </Button>
      {error && <p className="text-destructive w-full text-right text-xs">{error}</p>}
    </header>
  );
}
