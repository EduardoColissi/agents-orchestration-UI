// End-to-end check of the UI's server routes against a running v2 backend.
// Usage: npm run build && npm start (UI on :3001, API_URL pointing to the backend), then `node scripts/smoke.mjs`.
const UI = process.env.UI_URL ?? 'http://localhost:3001';

function session() {
  let cookie = '';
  return async (path, init = {}) => {
    const res = await fetch(`${UI}${path}`, { redirect: 'manual', ...init, headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) } });
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) cookie = set.map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ');
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, headers: res.headers, body, setCookie: set };
  };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const post = (call, path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });

const merchant = session();
const operator = session();

let r = await merchant('/');
check('anonymous visit redirects to /login', r.status === 307 && r.headers.get('location')?.endsWith('/login'));

r = await post(merchant, '/api/auth/login', { username: 'cliente1988', password: 'wrong' });
check('wrong password is refused', r.status === 401);

r = await post(merchant, '/api/auth/login', { username: 'cliente1988', password: 'demo-cliente1988' });
check('merchant login sets an httpOnly cookie', r.status === 200 && r.setCookie.some((c) => c.startsWith('getnet_token=') && /HttpOnly/i.test(c)), JSON.stringify(r.body));
check('the token is not in the response body', !JSON.stringify(r.body).includes('eyJ'));

r = await merchant('/');
check('merchant sees the chat page', r.status === 200);
r = await merchant('/operator');
check('merchant is sent away from /operator', r.status === 307);

r = await post(merchant, '/api/backend/chat', { message: 'Minha maquininha não conecta na internet' });
const conversationId = r.body.conversation_id;
check('turn 1 starts a conversation', r.status === 200 && !!conversationId, `${r.body.route} · ${r.body.agents?.join(' → ')}`);

r = await post(merchant, '/api/backend/chat', { message: 'E como reinicio ela?', conversation_id: conversationId });
check('turn 2 (follow-up) continues it', r.status === 200 && r.body.conversation_id === conversationId, r.body.answer?.slice(0, 90));

r = await merchant(`/api/backend/conversations/${conversationId}`);
check('the conversation is restorable (history)', r.status === 200 && r.body.messages?.length >= 4, `${r.body.messages?.length} messages`);
// The 8B sometimes answers turn 1 with "not found", which opens an assist handoff: the operator answers it below.
const assistId = r.body.open_handoff?.kind === 'assist' ? r.body.open_handoff.id : null;

// One open handoff per conversation: the replacement goes in a new conversation.
r = await post(merchant, '/api/backend/chat', { message: 'Quero trocar minha Get Smart GS-1988-0001 por uma nova' });
const replacementConversation = r.body.conversation_id;
const handoffId = r.body.handoff?.handoff_id;
check('replacement request is queued for approval', r.status === 200 && r.body.handoff?.kind === 'approval', `${handoffId} · ${r.body.handoff?.status}`);

r = await merchant(`/api/backend/conversations/${replacementConversation}`);
check('the conversation shows the open handoff', r.status === 200 && r.body.open_handoff?.id === handoffId);

r = await merchant('/api/backend/operator/handoffs');
check('merchant cannot read the operator queue', r.status === 403);
r = await merchant('/api/backend/auth/token');
check('routes outside the allowlist are not proxied', r.status === 404);

r = await post(operator, '/api/auth/login', { username: 'op.ana', password: 'demo-op.ana' });
check('operator login', r.status === 200 && r.body.role === 'operator');
r = await operator('/operator');
check('operator sees the queue page', r.status === 200);

r = await operator('/api/backend/operator/handoffs?status=pending');
check('operator sees the handoff in the queue', r.body.items?.some((h) => h.id === handoffId));
r = await operator(`/api/backend/operator/handoffs/${handoffId}`);
const version = r.body.version;
check('handoff detail has the proposed action', r.body.request?.proposed_action?.tool === 'request_terminal_replacement', JSON.stringify(r.body.request?.proposed_action?.input));

r = await operator(`/api/backend/operator/conversations/${replacementConversation}`);
check('operator reads the evidence', r.status === 200 && r.body.messages?.some((m) => m.evidence?.steps?.length));

r = await post(operator, `/api/backend/operator/handoffs/${handoffId}/resolve`, { action: 'approve', message: 'Troca aprovada.', expected_version: version });
check('operator approves; the agent resumes', r.status === 200 && r.body.handoff?.status === 'completed', r.body.message?.content?.slice(0, 120));

r = await post(operator, `/api/backend/operator/handoffs/${handoffId}/resolve`, { action: 'approve', expected_version: version });
check('a second approval is refused (409)', r.status === 409);

r = await merchant(`/api/backend/conversations/${replacementConversation}`);
const last = r.body.messages?.at(-1);
check('merchant receives the outcome in the chat', last?.handoff_id === handoffId && /TCK-/.test(last?.content ?? '') && r.body.open_handoff === null, last?.content?.slice(0, 120));

if (assistId) {
  r = await operator(`/api/backend/operator/handoffs/${assistId}`);
  r = await post(operator, `/api/backend/operator/handoffs/${assistId}/resolve`, { action: 'reply', message: 'Olá! Aqui é a Ana: segure o botão por 10 segundos para reiniciar.', expected_version: r.body.version });
  check('operator replies to the assist handoff', r.status === 200 && r.body.message?.role === 'operator');
  r = await merchant(`/api/backend/conversations/${conversationId}`);
  check('merchant sees the operator reply (UTF-8 intact)', r.body.messages?.at(-1)?.content.startsWith('Olá! Aqui é a Ana'));
}

r = await operator('/api/backend/operator/metrics');
check('operator metrics', r.status === 200 && r.body.turns > 0, `turns ${r.body.turns} · p95 ${r.body.turn_latency_ms?.p95} ms`);

await post(merchant, '/api/auth/logout', {});
r = await merchant(`/api/backend/conversations/${conversationId}`);
check('after sign out the proxy refuses', r.status === 401);

const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
