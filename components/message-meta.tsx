import { ExternalLink, GitBranchPlus, LifeBuoy, Route, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ChatResponse } from '@/lib/api';

const ROUTE_STYLES: Record<ChatResponse['route'], string> = {
  knowledge: 'bg-primary/20 text-primary border-primary/30',
  support: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  escalation: 'bg-chart-3/20 text-chart-3 border-chart-3/30',
  blocked: 'bg-destructive/20 text-destructive border-destructive/30',
};

/** Routing/tool/source/handoff details shown under an assistant message. */
export function MessageMeta({ response }: { response: ChatResponse }) {
  const { handoff } = response;
  return (
    <div className="mt-3 space-y-2 border-t border-border/60 pt-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={ROUTE_STYLES[response.route]}>
          <Route /> {response.route}
        </Badge>
        {response.agents.map((agent, i) => (
          <Badge key={`${agent}-${i}`} variant="secondary">
            {agent}
          </Badge>
        ))}
        <span className="text-muted-foreground ml-auto tabular-nums">{(response.latency_ms / 1000).toFixed(1)} s</span>
      </div>

      {response.replans?.map((r) => (
        <div key={`${r.after}-${r.signal}`} className="text-muted-foreground flex items-center gap-1.5">
          <GitBranchPlus className="size-3" />
          Replanned after {r.after}: <code className="bg-muted rounded px-1.5 py-0.5">{r.signal}</code> → {r.action.replace('_', ' ')}
        </div>
      ))}

      {response.tools_used.length > 0 && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-1.5">
          <Wrench className="size-3" />
          {response.tools_used.map((tool) => (
            <code key={tool} className="bg-muted rounded px-1.5 py-0.5">
              {tool}
            </code>
          ))}
        </div>
      )}

      {response.sources.length > 0 && (
        <ul className="space-y-0.5">
          {response.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                <ExternalLink className="size-3 shrink-0" />
                <span className="truncate">{source.title || source.url}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {handoff.required && (
        <div className="text-chart-3 flex flex-wrap items-center gap-1.5">
          <LifeBuoy className="size-3" />
          Human handoff · {handoff.reason}
          {handoff.handoff_id && (
            <code className="bg-muted rounded px-1.5 py-0.5">
              {handoff.handoff_id} · {handoff.kind} · {handoff.status}
            </code>
          )}
          {handoff.ticket_id && <code className="bg-muted rounded px-1.5 py-0.5">{handoff.ticket_id}</code>}
        </div>
      )}

      <div className="text-muted-foreground/60 font-mono">trace {response.trace_id}</div>
    </div>
  );
}
