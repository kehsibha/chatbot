# GTD

An AI-native **Getting Things Done** app. Talk to it like a coach — it captures,
clarifies, and organizes on your behalf, using Claude as the agent behind a
visible chain-of-thought interface.

- **Kanban board** as the primary visual surface (project views, Today, Inbox, Upcoming).
- **Voice orb** for talking to the coach; the **reasoning** panel streams thinking and tool use (no bottom chat strip).
- **Reasoning panel** (optional, off by default) — open with the **brain** button next to the mic (bottom-right) to stream thinking, tool calls, and results.
- **Voice-friendly**: designed for messy stream-of-consciousness dumps from a
  phone voice keyboard. Capture first, clarify later.
- Local-first: SQLite via Drizzle; runs entirely on your machine.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** + a small set of shadcn-flavored primitives on Radix
- **SQLite** via **better-sqlite3** + **Drizzle ORM**
- **TanStack Query** for client state
- **dnd-kit** for the Kanban board
- **Anthropic SDK** (Claude Sonnet 4.6 by default) driving the agent loop with
  streaming + extended thinking + tool use

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up your API key

Copy `.env.example` to `.env.local` (already created for you — empty) and paste
your Anthropic API key:

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=file:./gtd.db
```

Grab a key at <https://console.anthropic.com/settings/keys>. `.env.local` is
gitignored.

### 3. Initialize the database

```bash
pnpm db:migrate   # apply schema
pnpm db:seed      # load a few example projects and actions
```

### 4. Run the dev server

```bash
pnpm dev
```

If the dev server throws **`__webpack_modules__[moduleId] is not a function`** or **`Cannot find module './623.js'`** (or any missing file under `.next/server/`), the compiled cache is out of sync. **Stop every `pnpm dev` / `next dev` process**, then:

```bash
pnpm dev:clean
```

That removes `.next` and starts fresh. Hot reload alone cannot fix a broken chunk map.

### Where your data lives

Projects and actions are stored in **SQLite** at the path from `DATABASE_URL` (default **`./gtd.db`** in the project root). That file persists across app restarts; it is **not** in git. Back it up if you care about the machine (copy `gtd.db` elsewhere).

Open <http://localhost:3000>. You'll land on **Today**.

## How to use it

1. **Capture** — Voice-dictate from the orb (open it, speak, then send). Examples:
   - `"need to call the dentist tomorrow and buy cat food on the way home"`
   - `"idea: write a blog post about focus rituals"`
   - `"remind me to follow up with sarah on the design review"`
   The agent will either create the actions directly or drop them into the inbox
   if they need more thought.
2. **Clarify** — Open **Inbox** and say `"process my inbox"`. The agent walks
   each item and asks what you want to do with it, or makes best-guess decisions.
3. **Organize** — Drag cards between Kanban columns (Next / Waiting / Scheduled /
   Done) inside a project, or tell the agent `"move the dentist call to the
   health errands project"`.
4. **Engage** — Ask `"what should I do right now?"` and Claude will look at
   your current state and give you an opinionated recommendation.

## Architecture notes

- **Agent loop** (`src/lib/agent/`) — Manual streaming loop on top of
  `client.messages.stream()`. Yields typed events (`thinking_delta`,
  `message_delta`, `tool_call`, `tool_result`, `done`) to the caller. The
  `/api/agent` route handler forwards these to the browser as Server-Sent
  Events, and the `AgentProvider` context renders them into the reasoning panel
  as they stream.
- **Tools** (`src/lib/agent/tools.ts`) — ~9 tools (capture, clarify, create/update
  project/action, complete, delete, read state). Each tool has a Zod schema +
  an `execute` function that mutates the Drizzle DB. Tool results are surfaced
  in the reasoning panel and trigger React Query cache invalidation so the
  Kanban board updates live.
- **Events table** — Every agent step (user message, thinking, tool call, tool
  result) is persisted to the `events` table as an append-only audit log. The
  `projects` and `actions` tables are effectively a materialized view of this.
- **State snapshot** — Every agent turn opens with a JSON snapshot of current
  projects, inbox, today, and waiting lists so the agent has context without
  having to call `read_state` on every turn.

## Scripts

```bash
pnpm dev            # Next.js dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm db:generate    # generate drizzle migration from schema
pnpm db:migrate     # apply migrations
pnpm db:seed        # reset + reseed the DB with sample data
pnpm db:studio      # drizzle-kit studio (visual inspector)
```

## Project layout

```
src/
  app/
    layout.tsx            # root shell (providers + app shell)
    page.tsx              # redirects to /today
    today/                # Today view
    inbox/                # Inbox (unprocessed captures)
    projects/             # Project index
    projects/[id]/        # Single project Kanban
    upcoming/             # Time-bucketed upcoming list
    api/
      agent/              # streaming agent SSE endpoint
      actions/            # REST for actions
      projects/           # REST for projects
  components/
    app-shell.tsx         # sidebar + main + reasoning panel + voice orb
    sidebar.tsx
    reasoning-panel.tsx   # chain-of-thought stream (read-only)
    agent-context.tsx     # SSE client + React context
    action-row.tsx        # list-style row for actions
    ui/                   # button, card, input, checkbox primitives
  lib/
    agent/
      index.ts            # streaming agent loop
      tools.ts            # tool definitions + executors
      prompts.ts          # system prompt + state snapshot
    db/
      schema.ts           # Drizzle schema
      index.ts            # client singleton
      migrate.ts          # migration runner
      seed.ts             # sample data
    queries.ts            # TanStack Query hooks
    utils.ts              # cn helper
```

## Roadmap

- **Workspace context** — optional paths (local repo, strategy docs) the agent can read summaries from; long-term RAG / embeddings for “what you’re actually working on.”
- **Agent presence** — animated cursor(s) for parallel tool runs, optional TTS so you can *hear* the coach without reading markdown.
- Weekly Review mode (guided walk through all projects with stale detection)
- Calendar integration (two-way sync with Google Calendar for scheduled actions)
- Context tag filters (`@phone`, `@computer`, `@errands`, `@home`)
- Someday/Maybe and Reference shelves
- Voice input UI (browser SpeechRecognition + push-to-talk)
- Multi-user / auth (currently single-user local)
