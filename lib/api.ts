/** Mirrors the API contract in the backend's docs/spec.md §5. */
export interface ChatResponse {
  trace_id: string;
  answer: string;
  route: 'knowledge' | 'support' | 'escalation' | 'blocked';
  agents: string[];
  sources: { title: string; url: string }[];
  tools_used: string[];
  handoff: { required: boolean; reason: string | null; ticket_id: string | null };
  latency_ms: number;
}

export interface ChatError {
  error: string;
  details?: unknown;
  trace_id?: string;
}

export async function sendChat(message: string, userId: string): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, user_id: userId }),
  });
  const body = (await res.json()) as ChatResponse | ChatError;
  if (!res.ok) {
    const err = body as ChatError;
    throw new Error(err.details ? `${err.error}: ${JSON.stringify(err.details)}` : err.error ?? `HTTP ${res.status}`);
  }
  return body as ChatResponse;
}

export const EXAMPLE_PROMPTS = [
  "What's the difference between the Get Clássica and the Get Smart?",
  "When will the money from yesterday's sales be deposited?",
  "My card machine won't connect to the internet, what should I do?",
  "What's the euro exchange rate today?",
  'Can I sell through WhatsApp using the Payment Link?',
  'I want to talk to a human',
];
