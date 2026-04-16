## Agent-driven UI navigation

**Decision:** Add a `navigate_ui` tool whose executor returns a structured payload; the client listens for `tool_result` events for that tool and calls `router.push()` to the matching route.

**Why:** The agent already had full state in context and answered in chat without changing routes. Users expect voice commands like “go to my projects” to move the visible screen.

**Ruled out:** Returning opaque URLs from the model (error-prone ids), or inferring navigation from assistant text only (no reliable hook).

## Speech recognition transcript folding

**Decision:** Process only `SpeechRecognitionEvent.results` from `resultIndex` onward when appending finals and computing interim text.

**Why:** Browsers resend the entire cumulative `results` array on every `onresult` callback; iterating from 0 duplicated every finalized segment dozens of times.

**Ruled out:** Deduplicating by string heuristics (fragile across locales and phrasing).
