## Agent-driven UI navigation

**Decision:** Add a `navigate_ui` tool whose executor returns a structured payload; the client listens for `tool_result` events for that tool and calls `router.push()` to the matching route.

**Why:** The agent already had full state in context and answered in chat without changing routes. Users expect voice commands like “go to my projects” to move the visible screen.

**Ruled out:** Returning opaque URLs from the model (error-prone ids), or inferring navigation from assistant text only (no reliable hook).

## Reasoning panel hidden by default

**Decision:** `showReasoning` state in `AppShell` defaults to `false`; render `ReasoningPanel` only when true. A **Brain** button in the bottom-right dock (next to the mic) toggles visibility.

**Why:** User asked for a cleaner default canvas and wanted mic + reasoning controls together in the corner, not in the sidebar.

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
