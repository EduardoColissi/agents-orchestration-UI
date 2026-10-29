# Getnet Support — Chat UI

A Next.js interface for the [multi-agent support API](https://github.com/EduardoColissi/agents-orchestration) (v2). Dark theme with Getnet red as the accent, shadcn/ui components (Tailwind v4).

- **Merchants** chat with the agents. Conversations have memory (follow-ups keep the context) and survive a reload. Each answer shows what the orchestration did: route, agents, replans, tools, sources and human-handoff status. While a request is with a person, a banner shows it and the chat updates by itself when the specialist replies or decides.
- **Operators** work the human queue: the request, the action waiting for approval, the conversation and the audited evidence behind the last answer (route decision, rewritten question, every tool call with its output). They reply, approve or reject; approved actions run once and the agent continues from where it stopped. A strip shows latency percentiles and escalation/blocked rates.

## Run

```bash
cp .env.example .env     # API_URL=http://localhost:3000 (the backend, e.g. `docker compose up` in agents-orchestration)
npm install
npm run dev              # http://localhost:3001
```

Sign in with a demo user (the backend's demo identity provider): `cliente1988`, `cliente2000`, `ghost42` (merchants) or `op.ana`, `op.bruno` (operators); the password is `demo-<username>`. The login screen has one-click buttons for each.

> This UI targets the v2 backend (`main`). For the v1 backend (no auth, no memory) use this repository's history before the v2 commits.

## How it talks to the backend

The browser never calls the API directly and never sees the JWT:

- `POST /api/auth/login` exchanges the credentials at the backend's `POST /auth/token` and stores the token in an **httpOnly** cookie (`lib/session.ts`).
- `/api/backend/[...path]` is the only proxy: it forwards an **allowlist** of routes (chat, conversations, operator queue, evidence, metrics), adds the bearer token on the server and ends the session when the backend answers 401.
- Pages are server components that redirect by role (`/` merchant chat, `/operator` queue, `/login`). The backend still authorizes every call; the UI routing is only convenience.

## Checks

```bash
npm run typecheck
npm run build
npm run smoke             # with the UI running (npm start) and the backend up: 25 end-to-end checks through the UI routes
```

`scripts/smoke.mjs` signs in as a merchant and as an operator and goes through the whole flow: redirects, httpOnly cookie, a multi-turn conversation, a replacement request queued for approval, the operator reading the evidence and approving, the 409 on a second approval, the outcome arriving in the merchant's conversation, an operator reply with UTF-8 text, role separation, the allowlist and sign out.

## Structure

```
app/            login, merchant chat (/), operator queue (/operator), api/auth/*, api/backend/[...path] proxy
components/     chat.tsx, message-meta.tsx, operator-console.tsx, login-form.tsx, app-header.tsx
components/ui/  shadcn/ui: button, badge, card, input, textarea, scroll-area
lib/            api.ts (v2 contract + client), session.ts (server-only cookie session + backend fetch), utils.ts
scripts/        smoke.mjs (end-to-end check through the UI's server routes)
```
