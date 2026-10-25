'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, SendHorizontal, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { MessageMeta } from '@/components/message-meta';
import { EXAMPLE_PROMPTS, sendChat, type ChatResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Message =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; response?: ChatResponse; error?: boolean };

export function Chat() {
  const [userId, setUserId] = useState('cliente1988');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  async function submit(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput('');
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: message }]);
    setPending(true);
    try {
      const response = await sendChat(message, userId.trim() || 'cliente1988');
      setMessages((m) => [...m, { id: response.trace_id, role: 'assistant', text: response.answer, response }]);
    } catch (err) {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', text: (err as Error).message, error: true }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-xl">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Getnet Support</h1>
          <p className="text-muted-foreground text-xs">Router · Knowledge · Support · Escalation · Personality</p>
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          user_id
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} className="h-8 w-36 font-mono text-xs" />
        </label>
      </header>

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 p-4">
            {messages.length === 0 && (
              <div className="text-muted-foreground mx-auto max-w-md py-10 text-center text-sm">
                <p className="mb-4">Ask about Getnet products, your sales and card machines, or anything else.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <Button key={prompt} variant="outline" size="sm" className="h-auto whitespace-normal text-left text-xs" onClick={() => submit(prompt)}>
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', m.role === 'user' ? 'bg-secondary' : 'bg-primary/20 text-primary')}>
                  {m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
                </div>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm',
                    m.role === 'assistant' && m.error && 'border-destructive/40 text-destructive border',
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.role === 'assistant' && m.response && <MessageMeta response={m.response} />}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex gap-3">
                <div className="bg-primary/20 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Bot className="size-4" />
                </div>
                <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
                  <Loader2 className="size-4 animate-spin" /> Routing and answering…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit(input);
              }
            }}
            placeholder="Type your message… (Enter to send, Shift+Enter for a new line)"
            className="max-h-40 min-h-10 resize-none"
            disabled={pending}
          />
          <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send">
            {pending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          </Button>
        </form>
      </Card>
    </div>
  );
}
