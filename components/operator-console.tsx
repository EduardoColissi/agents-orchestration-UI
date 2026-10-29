'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Inbox, Loader2, MessageSquareReply, RefreshCw, ScrollText, ShieldCheck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError, type Handoff, type HandoffDetail, type Metrics, type Trace } from '@/lib/api';
import { cn } from '@/lib/utils';

const STATUSES = ['pending', 'completed', 'expired'] as const;
const QUEUE_POLL_MS = 5000;
const METRICS_POLL_MS = 15000;

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
};

export function OperatorConsole() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('pending');
  const [queue, setQueue] = useState<Handoff[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const loadQueue = useCallback(async () => {
    const res = await api.queue(status).catch(() => null);
    if (res) setQueue(res.items);
  }, [status]);

  useEffect(() => {
    void loadQueue();
    const timer = setInterval(() => void loadQueue(), QUEUE_POLL_MS);
    return () => clearInterval(timer);
  }, [loadQueue]);

  useEffect(() => {
    const load = () => api.metrics().then(setMetrics).catch(() => undefined);
    void load();
    const timer = setInterval(load, METRICS_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {metrics && <MetricsStrip metrics={metrics} />}

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[300px_1fr]">
        <Card className="flex min-h-0 flex-col gap-0 overflow-hidden py-0">
          <div className="flex items-center gap-1 border-b p-2">
            {STATUSES.map((s) => (
              <Button key={s} variant={s === status ? 'secondary' : 'ghost'} size="sm" className="text-xs" onClick={() => setStatus(s)}>
                {s}
              </Button>
            ))}
            <Button variant="ghost" size="icon" className="ml-auto size-8" onClick={() => void loadQueue()} aria-label="Refresh">
              <RefreshCw />
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {queue.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
                <Inbox className="size-5" /> No {status} handoffs
              </div>
            ) : (
              <ul className="divide-y">
                {queue.map((h) => (
                  <li key={h.id}>
                    <button className={cn('hover:bg-muted/60 w-full space-y-1 px-3 py-2.5 text-left text-xs', selectedId === h.id && 'bg-muted')} onClick={() => setSelectedId(h.id)}>
                      <div className="flex items-center gap-2">
                        <KindBadge kind={h.kind} />
                        <span className="font-mono">{h.id}</span>
                        <span className="text-muted-foreground ml-auto">{ago(h.created_at)}</span>
                      </div>
                      <p className="line-clamp-2">{h.request.message}</p>
                      <p className="text-muted-foreground">
                        {h.owner_id} · {h.reason}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </Card>

        <Card className="min-h-0 gap-0 overflow-hidden py-0">
          {selectedId ? (
            <HandoffPanel key={selectedId} id={selectedId} onResolved={() => void loadQueue()} />
          ) : (
            <div className="text-muted-foreground flex h-full min-h-60 items-center justify-center p-6 text-sm">Select a handoff to see its context and act on it.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: Handoff['kind'] }) {
  return (
    <Badge variant="outline" className={kind === 'approval' ? 'border-chart-3/40 bg-chart-3/15 text-chart-3' : 'border-chart-2/40 bg-chart-2/15 text-chart-2'}>
      {kind}
    </Badge>
  );
}

function MetricsStrip({ metrics }: { metrics: Metrics }) {
  const items = [
    ['turns', String(metrics.turns)],
    ['p50', `${(metrics.turn_latency_ms.p50 / 1000).toFixed(1)} s`],
    ['p95', `${(metrics.turn_latency_ms.p95 / 1000).toFixed(1)} s`],
    ['p99', `${(metrics.turn_latency_ms.p99 / 1000).toFixed(1)} s`],
    ['escalation', `${Math.round(metrics.escalation_rate * 100)}%`],
    ['blocked', `${Math.round(metrics.blocked_rate * 100)}%`],
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="bg-card rounded-lg border px-3 py-2">
          <p className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</p>
          <p className="font-semibold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}

function HandoffPanel({ id, onResolved }: { id: string; onResolved: () => void }) {
  const [handoff, setHandoff] = useState<HandoffDetail | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const load = useCallback(() => api.handoff(id).then(setHandoff).catch((err) => setNotice({ tone: 'error', text: (err as Error).message })), [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function toggleEvidence() {
    if (!showEvidence && handoff && !trace) setTrace(await api.trace(handoff.conversation_id).catch(() => null));
    setShowEvidence((v) => !v);
  }

  async function resolve(action: 'reply' | 'approve' | 'reject') {
    if (!handoff) return;
    setBusy(action);
    setNotice(null);
    try {
      const res = await api.resolve(handoff.id, { action, expected_version: handoff.version, ...(note.trim() ? { message: note.trim() } : {}) });
      setNotice({ tone: 'ok', text: `Done. The merchant now sees: “${res.message.content}”` });
      setNote('');
      onResolved();
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 409) setNotice({ tone: 'warn', text: `Not applied: ${String(e.body.error)} (now ${String(e.body.status)}). Someone else resolved it or it expired.` });
      else if (e.status === 503) setNotice({ tone: 'warn', text: 'Decision recorded; the answer will be delivered automatically.' });
      else setNotice({ tone: 'error', text: e.message });
    } finally {
      setBusy(null);
      void load();
    }
  }

  if (!handoff) return <div className="text-muted-foreground flex min-h-60 items-center justify-center gap-2 text-sm">{notice?.text ?? <Loader2 className="size-4 animate-spin" />}</div>;

  const pending = handoff.status === 'pending';
  const proposed = handoff.request.proposed_action;
  const evidence = trace?.messages.filter((m) => m.evidence).at(-1)?.evidence ?? null;

  return (
    <ScrollArea className="h-full max-h-[calc(100dvh-14rem)]">
      <div className="space-y-4 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={handoff.kind} />
          <span className="font-mono">{handoff.id}</span>
          <Badge variant="secondary">{handoff.status}</Badge>
          <span className="text-muted-foreground ml-auto text-xs">
            v{handoff.version} · expires {new Date(handoff.expires_at).toLocaleString()}
          </span>
        </div>

        <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
          <span>
            merchant <span className="text-foreground font-mono">{handoff.owner_id}</span>
          </span>
          <span>
            reason <span className="text-foreground">{handoff.reason}</span>
          </span>
        </div>

        <section className="space-y-1">
          <h3 className="text-muted-foreground text-xs font-medium uppercase">Request</h3>
          <p className="bg-muted rounded-lg px-3 py-2">{handoff.request.message}</p>
        </section>

        {proposed && (
          <section className="space-y-1">
            <h3 className="text-muted-foreground text-xs font-medium uppercase">Action waiting for approval</h3>
            <div className="border-chart-3/40 bg-chart-3/10 rounded-lg border px-3 py-2">
              <code className="text-chart-3 font-mono text-xs">{proposed.tool}</code>
              <pre className="mt-1 overflow-x-auto text-xs">{JSON.stringify(proposed.input, null, 2)}</pre>
              <p className="text-muted-foreground mt-1 text-xs">Nothing has been executed yet. Approve runs it once; the agent then continues from where it stopped.</p>
            </div>
          </section>
        )}

        <section className="space-y-1">
          <h3 className="text-muted-foreground text-xs font-medium uppercase">Conversation</h3>
          {handoff.context.summary && <pre className="bg-muted/50 text-muted-foreground whitespace-pre-wrap rounded-lg px-3 py-2 text-xs">{handoff.context.summary}</pre>}
          <ul className="space-y-1.5">
            {handoff.context.messages.map((m, i) => (
              <li key={i} className={cn('rounded-lg px-3 py-2 text-xs', m.role === 'merchant' ? 'bg-secondary' : 'bg-muted')}>
                <span className="text-muted-foreground font-medium">{m.role}</span> · <span className="whitespace-pre-wrap">{m.content}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <Button variant="outline" size="sm" onClick={() => void toggleEvidence()}>
            <ScrollText /> {showEvidence ? 'Hide evidence' : 'Show evidence (audited)'}
          </Button>
          {showEvidence &&
            (evidence ? (
              <div className="space-y-2 text-xs">
                {evidence.route_decision && (
                  <p className="text-muted-foreground">
                    route <span className="text-foreground">{evidence.route_decision.route}</span> · plan {evidence.route_decision.plan.join(' → ')} · confidence {evidence.route_decision.confidence}
                    {evidence.standalone_query && (
                      <>
                        {' '}
                        · rewritten as <q className="text-foreground">{evidence.standalone_query}</q>
                      </>
                    )}
                  </p>
                )}
                {evidence.steps.flatMap((step) =>
                  step.tools.map((tool, i) => (
                    <details key={`${step.agent}-${tool.name}-${i}`} className="bg-muted/50 rounded-lg px-3 py-2">
                      <summary className="cursor-pointer">
                        <span className="text-muted-foreground">{step.agent}</span> · <code>{tool.name}</code> <span className="text-muted-foreground">{JSON.stringify(tool.input)}</span>
                        {tool.isError && <span className="text-destructive"> · error</span>}
                      </summary>
                      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap">{tool.output}</pre>
                    </details>
                  )),
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">No tool evidence for this conversation.</p>
            ))}
        </section>

        {notice && (
          <p className={cn('rounded-lg px-3 py-2 text-xs', notice.tone === 'ok' && 'bg-chart-5/15 text-chart-5', notice.tone === 'warn' && 'bg-chart-3/15 text-chart-3', notice.tone === 'error' && 'bg-destructive/15 text-destructive')}>
            {notice.text}
          </p>
        )}

        {pending ? (
          <section className="space-y-2 border-t pt-4">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={handoff.kind === 'assist' ? 'Your reply to the merchant (required to reply)' : 'Optional note — the agent tells the merchant why'}
              className="min-h-20"
              disabled={!!busy}
            />
            <div className="flex flex-wrap gap-2">
              {handoff.kind === 'assist' ? (
                <Button onClick={() => void resolve('reply')} disabled={!!busy || !note.trim()}>
                  {busy === 'reply' ? <Loader2 className="animate-spin" /> : <MessageSquareReply />} Reply
                </Button>
              ) : (
                <Button onClick={() => void resolve('approve')} disabled={!!busy}>
                  {busy === 'approve' ? <Loader2 className="animate-spin" /> : <Check />} Approve
                </Button>
              )}
              <Button variant="outline" onClick={() => void resolve('reject')} disabled={!!busy}>
                {busy === 'reject' ? <Loader2 className="animate-spin" /> : <X />} Reject
              </Button>
              {busy === 'approve' && <span className="text-muted-foreground self-center text-xs">Running the action and resuming the agent…</span>}
            </div>
          </section>
        ) : (
          handoff.resolution && (
            <p className="text-muted-foreground flex items-center gap-1.5 border-t pt-4 text-xs">
              <ShieldCheck className="size-3.5" /> {handoff.resolution.action} by {handoff.resolved_by}
              {handoff.resolution.message && <> — “{handoff.resolution.message}”</>}
            </p>
          )
        )}
      </div>
    </ScrollArea>
  );
}
