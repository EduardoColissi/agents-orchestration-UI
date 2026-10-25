import { Chat } from '@/components/chat';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6">
      <Chat />
    </main>
  );
}
