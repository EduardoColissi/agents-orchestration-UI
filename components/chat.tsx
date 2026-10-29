'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Headset, Loader2, MessageSquarePlus, RotateCw, SendHorizontal, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { MessageMeta } from '@/components/message-meta';
import { api, ApiError, EXAMPLE_PROMPTS, type ChatResponse, type ConversationMessage, type ConversationView } from '@/lib/api';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  role: 'merchant' | 'assistant' | 'operator';
  text: string;
  response?: ChatResponse;
  error?: boolean;
  /** Set when the message is the outcome of a human handoff (operator reply or resumed agent). */
  handoffId?: string | null;
};

type OpenHandoff = ConversationView['open_handoff'];

const POLL_MS = 5000;
const storageKey = (user: string) => `getnet:conversation:${user}`;

const readStored = (user: string) => {
  try {
    return localStorage.getItem(storageKey(user));
  } catch {
    return null;
  }
};
const writeStored = (user: string, id: string | null) => {
  try {
    if (id) localStorage.setItem(storageKey(user), id);
    else localStorage.removeItem(storageKey(user));
  } catch {
    // Private mode: the conversation still works, it just won't survive a reload.
  }
};

const fromServer = (m: ConversationMessage, i: number): Message => ({ id: `${m.created_at}-${i}`, role: m.role, text: m.content, handoffId: m.handoff_id });

export function Chat({ user }: { user: string }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [openHandoff, setOpenHandoff] = useState<OpenHandoff>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** The conversation the UI is showing now: late poll results for another one are dropped. */
  const currentId = useRef<string | null>(null);

  // Restore the last conversation of this user after a reload (memory lives in the backend).
  const restore = useCallback(() => {
    const stored = readStored(user);
    if (!stored) return setRestoring(false);
    setRestoring(true);
    setRestoreError(null);
    api
      .conversation(stored)
      .then((view) => {
        currentId.current = view.id;
        setConversationId(view.id);
        setMessages(view.messages.map(fromServer));
        setOpenHandoff(view.open_handoff);
      })
      .catch((err) => {
        // 404: the conversation is gone. Anything else: keep the id, so a reply to an open
        // handoff is not lost in a new conversation, and let the merchant retry.
        if (err instanceof ApiError && err.status === 404) writeStored(user, null);
        else setRestoreError((err as Error).message);
      })
      .finally(() => setRestoring(false));
  }, [user]);

  useEffect(() => restore(), [restore]);

  // While a request is with a human, poll the conversation for the operator's outcome.
  const poll = useCallback(async () => {
    if (!conversationId || !openHandoff) return;
    const view = await api.conversation(conversationId).catch(() => null);
    if (!view || view.id !== currentId.current) return;
    const outcomes = view.messages.filter((m) => m.handoff_id === openHandoff.id);
    if (outcomes.length) {
      setMessages((current) => (current.some((m) => m.handoffId === openHandoff.id) ? current : [...current, ...outcomes.map(fromServer)]));
    }
    setOpenHandoff(view.open_handoff);
  }, [conversationId, openHandoff]);

  useEffect(() => {
    if (!openHandoff) return;
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [openHandoff, poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  async function submit(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput('');
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'merchant', text: message }]);
    setPending(true);
    try {
      const response = await api.chat(message, conversationId ?? undefined);
      currentId.current = response.conversation_id;
      setConversationId(response.conversation_id);
      writeStored(user, response.conversation_id);
      setMessages((m) => [...m, { id: response.trace_id, role: 'assistant', text: response.answer, response }]);
      const h = response.handoff;
      if (h.handoff_id && h.kind && h.status && h.status !== 'completed' && h.status !== 'expired') setOpenHandoff({ id: h.handoff_id, kind: h.kind, status: h.status });
    } catch (err) {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', text: (err as Error).message, error: true }]);
    } finally {
      setPending(false);
    }
  }

  function newConversation() {
    currentId.current = null;
    setRestoreError(null);
    writeStored(user, null);
    setConversationId(null);
    setMessages([]);
    setOpenHandoff(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="truncate font-mono">{conversationId ? `conversation ${conversationId}` : 'new conversation'}</span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={newConversation} disabled={pending || (!conversationId && messages.length === 0)}>
          <MessageSquarePlus /> New conversation
        </Button>
      </div>

      {restoreError && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
          <span>Could not load your conversation ({restoreError}).</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={restore}>
            <RotateCw /> Retry
          </Button>
        </div>
      )}

      {openHandoff && (
        <div className="border-chart-3/40 bg-chart-3/10 text-chart-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
          <Headset className="size-4 shrink-0" />
          <span>
            Request <code className="font-mono">{openHandoff.id}</code> is with a Getnet specialist ({openHandoff.kind === 'approval' ? 'waiting for approval' : 'waiting for a reply'}).
            This chat updates automatically when they answer — you can keep asking other questions meanwhile.
          </span>
          <Loader2 className="ml-auto size-3.5 shrink-0 animate-spin" />
        </div>
      )}

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-4">
            {restoring && (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
                <Loader2 className="size-4 animate-spin" /> Restoring your conversation…
              </div>
            )}

            {!restoring && !restoreError && messages.length === 0 && (
              <div className="text-muted-foreground mx-auto max-w-md py-10 text-center text-sm">
                <p className="mb-4">Ask about Getnet products, your sales and card machines, or anything else. Follow-up questions keep the context.</p>
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
              <div key={m.id} className={cn('flex gap-3', m.role === 'merchant' && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    m.role === 'merchant' && 'bg-secondary',
                    m.role === 'assistant' && 'bg-primary/20 text-primary',
                    m.role === 'operator' && 'bg-chart-2/20 text-chart-2',
                  )}
                >
                  {m.role === 'merchant' ? <User className="size-4" /> : m.role === 'operator' ? <Headset className="size-4" /> : <Bot className="size-4" />}
                </div>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    m.role === 'merchant' && 'bg-primary text-primary-foreground rounded-tr-sm',
                    m.role === 'assistant' && 'bg-muted rounded-tl-sm',
                    m.role === 'operator' && 'border-chart-2/40 bg-chart-2/10 rounded-tl-sm border',
                    m.error && 'border-destructive/40 text-destructive border',
                  )}
                >
                  {m.handoffId && m.role !== 'merchant' && (
                    <p className="text-muted-foreground mb-1 text-[11px] font-medium">
                      {m.role === 'operator' ? 'Getnet specialist' : 'After the specialist’s decision'} · <span className="font-mono">{m.handoffId}</span>
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.response && <MessageMeta response={m.response} />}
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
            disabled={pending || restoring || !!restoreError}
          />
          <Button type="submit" size="icon" disabled={pending || restoring || !!restoreError || !input.trim()} aria-label="Send">
            {pending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          </Button>
        </form>
      </Card>
    </div>
  );
}
