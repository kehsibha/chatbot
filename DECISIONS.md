## Agent-driven UI navigation

**Decision:** Add a `navigate_ui` tool whose executor returns a structured payload; the client listens for `tool_result` events for that tool and calls `router.push()` to the matching route.

**Why:** The agent already had full state in context and answered in chat without changing routes. Users expect voice commands like “go to my projects” to move the visible screen.

**Ruled out:** Returning opaque URLs from the model (error-prone ids), or inferring navigation from assistant text only (no reliable hook).

## Reasoning panel hidden by default

**Decision:** `showReasoning` state in `AppShell` defaults to `false`; render `ReasoningPanel` only when true. A **Brain** button in the bottom-right dock (next to the mic) toggles visibility.

**Why:** User asked for a cleaner default canvas and wanted mic + reasoning controls together in the corner, not in the sidebar.

## Voice panel layout + markdown

**Decision:** Rebuild `VoicePanel` as chronological **turn blocks** (user bubble → agent markdown via small in-repo `VoiceMarkdown` parser → collapsible gray **Activity** `<details>` for thinking + tools). Scroll container uses `useLayoutEffect` to pin `scrollTop` to `scrollHeight` on step/transcript changes.

**Why:** `react-markdown` pulled `micromark` into Next’s server bundle and caused missing `vendor-chunks` runtime errors; a tiny parser covers headings, lists, fenced code, and inline bold/code/links for voice replies.

## App halo while agent runs

**Decision:** `AgentControlHalo` — `pointer-events-none` fixed inset with inner rounded ring using `agent-app-halo` CSS animation, driven by `running` from `AgentProvider`.

**Why:** Clear “system is acting” affordance without blocking clicks.

## Touch glow on `tool_call` (not only `tool_result`)

**Decision:** `computeTouchHighlightKeysFromToolCall` + `queueMicrotask` pulse on `tool_call` SSE, lengthen pulse duration to 1.4s, strengthen CSS (outline + brighter shadow).

**Why:** Highlights were easy to miss during slow tool execution; result-only pulse felt disconnected.

## Voice orb hydration

**Decision:** Always render the same bottom-right dock (brain + mic); gate speech with `mounted && speech.isSupported` and disable the mic until then. Add `suppressHydrationWarning` on `<body>` for extension-injected attributes (e.g. Feedly).

**Why:** `isSupported` was false during SSR and true in Chrome, so the server rendered one branch and the client another.

## Agent “touch” UI glow

**Decision:** On each successful mutating `tool_result`, derive string keys (`region:*`, `route:*`, `project:*`, `action:*`) via `computeTouchHighlightKeys`, store them in `AgentProvider` for ~900ms, and apply a global CSS class `agent-touch-glow` on matching wrappers (`AgentRegionGlow`, `AgentRouteGlow`, `AgentProjectGlow`, `AgentActionGlow`).

**Why:** User asked for visible feedback when the agent affects parts of the app; a short light-blue box-shadow pulse reads clearly without persisting state in the DB.

**Ruled out:** Persisting highlight state server-side; coupling glow to `tool_call` before success (would flash on errors).

## Faster in-app navigation

**Decision:** Raise TanStack Query `staleTime` / `gcTime` for local reads, enable explicit `prefetch` on sidebar and project-card links plus `prefetchProject()` on hover/focus, and add route-level `loading.tsx` skeletons.

**Why:** Each route was refetching on every visit while data was still “stale” after 10s; project Kanban blocked the whole page until fetch completed. Longer freshness + prefetch + instant skeleton feedback makes clicks feel immediate for a local SQLite app.

**Ruled out:** `keepPreviousData` on `useProject` (would flash wrong project when switching ids).

## Remove full-width bottom agent bar

**Decision:** Remove `AgentBar` from `AppShell`. Do not replace it with another persistent text composer; the **voice orb** sends to `/api/agent`, and the **reasoning panel** only shows streamed thinking/tools/messages.

**Why:** The user wanted the bottom chat strip gone entirely; duplicate inputs (reasoning footer + orb) still felt like the same UI pattern.

**Trade-off:** No keyboard capture in chrome — voice-first unless we add a minimal modal/command-palette later.

## Speech recognition transcript folding

**Decision:** Process only `SpeechRecognitionEvent.results` from `resultIndex` onward when appending finals and computing interim text.

**Why:** Browsers resend the entire cumulative `results` array on every `onresult` callback; iterating from 0 duplicated every finalized segment dozens of times.

**Ruled out:** Deduplicating by string heuristics (fragile across locales and phrasing).
