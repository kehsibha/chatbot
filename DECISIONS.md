## Agent-driven UI navigation

**Decision:** Add a `navigate_ui` tool whose executor returns a structured payload; the client listens for `tool_result` events for that tool and calls `router.push()` to the matching route.

**Why:** The agent already had full state in context and answered in chat without changing routes. Users expect voice commands like “go to my projects” to move the visible screen.

**Ruled out:** Returning opaque URLs from the model (error-prone ids), or inferring navigation from assistant text only (no reliable hook).

## Faster in-app navigation

**Decision:** Raise TanStack Query `staleTime` / `gcTime` for local reads, enable explicit `prefetch` on sidebar and project-card links plus `prefetchProject()` on hover/focus, and add route-level `loading.tsx` skeletons.

**Why:** Each route was refetching on every visit while data was still “stale” after 10s; project Kanban blocked the whole page until fetch completed. Longer freshness + prefetch + instant skeleton feedback makes clicks feel immediate for a local SQLite app.

**Ruled out:** `keepPreviousData` on `useProject` (would flash wrong project when switching ids).

## Remove full-width bottom agent bar

**Decision:** Remove `AgentBar` from `AppShell` and fold a small textarea + send control into the bottom of `ReasoningPanel` so typing to the agent does not consume a permanent strip across the main canvas.

**Why:** The user wanted the bottom panel gone; voice + right-rail messaging keeps capture and visible agency without competing with Kanban/lists for vertical space.

**Ruled out:** Dropping typed input entirely (keyboard-heavy GTD workflows still need it).

## Speech recognition transcript folding

**Decision:** Process only `SpeechRecognitionEvent.results` from `resultIndex` onward when appending finals and computing interim text.

**Why:** Browsers resend the entire cumulative `results` array on every `onresult` callback; iterating from 0 duplicated every finalized segment dozens of times.

**Ruled out:** Deduplicating by string heuristics (fragile across locales and phrasing).
