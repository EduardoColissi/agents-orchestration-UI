/** Mirrors the API contract in the backend's docs/spec.md §5 (v2). The browser only talks to this app's /api routes. */

export type Route = 'knowledge' | 'support' | 'escalation' | 'blocked';
export type HandoffKind = 'assist' | 'approval';
export type Role = 'merchant' | 'operator';

export interface ChatResponse {
  trace_id: string;
  conversation_id: string;
  answer: string;
  route: Route;
  agents: string[];
  sources: { title: string; url: string }[];
  tools_used: string[];
  handoff: { required: boolean; reason: string | null; ticket_id: string | null; handoff_id: string | null; kind: HandoffKind | null; status: string | null };
  replans?: { after: string; signal: string; action: string }[];
  latency_ms: number;
}

export interface ConversationMessage {
  role: 'merchant' | 'assistant' | 'operator';
  content: string;
  created_at: string;
  handoff_id: string | null;
}

export interface ConversationView {
  id: string;
  created_at: string;
  messages: ConversationMessage[];
  open_handoff: { id: string; kind: HandoffKind; status: string } | null;
}

export interface Handoff {
  id: string;
  kind: HandoffKind;
  reason: string;
  status: 'pending' | 'resuming' | 'completed' | 'expired';
  version: number;
  conversation_id: string;
  owner_id: string;
  request: { message: string; language: string; proposed_action?: { tool: string; input: Record<string, unknown> } };
  resolution: { action: string; message?: string } | null;
  resolved_by: string | null;
  created_at: string;
  expires_at: string;
}

export interface HandoffDetail extends Handoff {
  context: { summary: string; messages: { role: string; content: string; created_at: string }[] };
}

export interface ToolEvidence {
  name: string;
  input: unknown;
  output: string;
  isError: boolean;
}

export interface Trace {
  id: string;
  owner_id: string;
  summary: string;
  messages: Array<{
    role: string;
    content: string;
    route: string | null;
    evidence: { route_decision: { route: string; plan: string[]; confidence: number } | null; standalone_query: string | null; steps: { agent: string; tools: ToolEvidence[] }[] } | null;
    created_at: string;
  }>;
}

export interface Metrics {
  turns: number;
  turn_latency_ms: { p50: number; p95: number; p99: number };
  escalation_rate: number;
  blocked_rate: number;
  stages: { key: string; count: number; p50_ms: number; p95_ms: number; error_rate: number; input_tokens: number; output_tokens: number }[];
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly body: Record<string, unknown>) {
    super(code);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: init?.body ? { 'content-type': 'application/json' } : undefined, cache: 'no-store' });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/auth')) window.location.href = '/login';
  if (!res.ok) {
    const details = body.details ? `: ${typeof body.details === 'string' ? body.details : JSON.stringify(body.details)}` : '';
    throw new ApiError(res.status, `${String(body.error ?? `HTTP ${res.status}`)}${details}`, body);
  }
  return body as T;
}

const backend = <T>(path: string, init?: RequestInit) => call<T>(`/api/backend/${path}`, init);

export const api = {
  login: (username: string, password: string) => call<{ sub: string; role: Role }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => call<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: '{}' }),
  chat: (message: string, conversationId?: string) =>
    backend<ChatResponse>('chat', { method: 'POST', body: JSON.stringify({ message, ...(conversationId ? { conversation_id: conversationId } : {}) }) }),
  conversation: (id: string) => backend<ConversationView>(`conversations/${id}`),
  queue: (status = 'pending') => backend<{ items: Handoff[] }>(`operator/handoffs?status=${status}`),
  handoff: (id: string) => backend<HandoffDetail>(`operator/handoffs/${id}`),
  resolve: (id: string, body: { action: 'reply' | 'approve' | 'reject'; message?: string; expected_version: number }) =>
    backend<{ handoff: Handoff; message: { role: string; content: string } }>(`operator/handoffs/${id}/resolve`, { method: 'POST', body: JSON.stringify(body) }),
  trace: (conversationId: string) => backend<Trace>(`operator/conversations/${conversationId}`),
  metrics: () => backend<Metrics>('operator/metrics'),
};

export const DEMO_USERS: { username: string; role: Role; note: string }[] = [
  { username: 'cliente1988', role: 'merchant', note: 'Padaria Pão Dourado · Get Smart offline' },
  { username: 'cliente2000', role: 'merchant', note: 'Mercado Bairro Alto' },
  { username: 'ghost42', role: 'merchant', note: 'no Getnet account' },
  { username: 'op.ana', role: 'operator', note: 'operator' },
  { username: 'op.bruno', role: 'operator', note: 'operator' },
];

export const EXAMPLE_PROMPTS = [
  "What's the difference between the Get Clássica and the Get Smart?",
  "When will the money from yesterday's sales be deposited?",
  "My card machine won't connect to the internet, what should I do?",
  'Minha maquininha não conecta na internet',
  'I want to replace my Get Smart GS-1988-0001 with a new one',
  'I want to talk to a human',
];
