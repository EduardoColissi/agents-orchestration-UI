# Getnet Support — Chat UI

A small Next.js chat interface for the [multi-agent support API](../agents-orchestration). Dark theme with a purple accent, built with shadcn/ui components (Tailwind v4).

Each assistant message shows the answer plus what the orchestration did: route, agents that ran (including the Personality stage), tools used, sources, human-handoff status and the `trace_id` to look up in the API logs.

## Run

```bash
cp .env.example .env     # API_URL=http://localhost:3000 (the backend)
npm install
npm run dev              # http://localhost:3001
```

The browser never calls the API directly: `app/api/chat/route.ts` is a server-side proxy to `API_URL`, which avoids CORS and keeps the backend address out of the client.

## Structure

```
app/            layout (always dark), page, api/chat proxy route
components/     chat.tsx (state, send, example prompts), message-meta.tsx (route/agents/tools/sources)
components/ui/  shadcn/ui: button, badge, card, input, textarea, scroll-area
lib/            api.ts (contract + fetch), utils.ts (cn)
```

`npm run build` and `npm run typecheck` must pass before committing.
