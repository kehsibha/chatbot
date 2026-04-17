"use client";
/**
 * AgentContext — holds the live state of the current agent run so every
 * part of the UI (chat bar, reasoning panel, board) can react to it.
 *
 * `send()` POSTs to /api/agent, parses the SSE stream, and dispatches
 * events into local React state. It also invalidates TanStack Query
 * caches on `tool_result` so the board refetches affected slices.
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { hrefFromNavigateUIResult } from "@/lib/agent/navigation";
import { computeTouchHighlightKeys } from "@/lib/agent/ui-highlight";
import { computeTouchHighlightKeysFromToolCall } from "@/lib/agent/ui-highlight-from-call";

export type AgentEvent =
  | { type: "thinking_delta"; text: string }
  | { type: "thinking_stop" }
  | { type: "message_delta"; text: string }
  | { type: "message_stop" }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      id: string;
      name: string;
      result: unknown;
      isError?: boolean;
    }
  | { type: "done"; runId: string }
  | { type: "error"; message: string };

export type AgentStep =
  | { kind: "user"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "message"; text: string }
  | { kind: "tool"; id: string; name: string; input: unknown; result?: unknown; isError?: boolean }
  | { kind: "error"; text: string };

type Ctx = {
  steps: AgentStep[];
  running: boolean;
  /** Keys like `region:inbox`, `route:/today`, `project:id`, `action:id` for UI glow */
  touchGlowKeys: readonly string[];
  touchGlowToken: number;
  send: (message: string) => Promise<void>;
  clear: () => void;
};

const AgentCtx = React.createContext<Ctx | null>(null);

export function useAgent() {
  const ctx = React.useContext(AgentCtx);
  if (!ctx) throw new Error("useAgent must be used inside AgentProvider");
  return ctx;
}

const GLOW_MS = 1400;

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [steps, setSteps] = React.useState<AgentStep[]>([]);
  const [running, setRunning] = React.useState(false);
  const [touchGlowKeys, setTouchGlowKeys] = React.useState<string[]>([]);
  const [touchGlowToken, setTouchGlowToken] = React.useState(0);
  const glowClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const pulseTouchGlow = React.useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    if (glowClearRef.current) clearTimeout(glowClearRef.current);
    setTouchGlowKeys(keys);
    setTouchGlowToken((t) => t + 1);
    glowClearRef.current = setTimeout(() => {
      setTouchGlowKeys([]);
      glowClearRef.current = null;
    }, GLOW_MS);
  }, []);

  React.useEffect(
    () => () => {
      if (glowClearRef.current) clearTimeout(glowClearRef.current);
    },
    [],
  );

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["actions"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [queryClient]);

  const handleEvent = React.useCallback(
    (event: AgentEvent) => {
      setSteps((prev) => {
        const next = [...prev];
        switch (event.type) {
          case "thinking_delta": {
            const last = next[next.length - 1];
            if (last && last.kind === "thinking") {
              next[next.length - 1] = {
                kind: "thinking",
                text: last.text + event.text,
              };
            } else {
              next.push({ kind: "thinking", text: event.text });
            }
            return next;
          }
          case "message_delta": {
            const last = next[next.length - 1];
            if (last && last.kind === "message") {
              next[next.length - 1] = {
                kind: "message",
                text: last.text + event.text,
              };
            } else {
              next.push({ kind: "message", text: event.text });
            }
            return next;
          }
          case "tool_call": {
            next.push({
              kind: "tool",
              id: event.id,
              name: event.name,
              input: event.input,
            });
            queueMicrotask(() =>
              pulseTouchGlow(
                computeTouchHighlightKeysFromToolCall(
                  event.name,
                  event.input,
                ),
              ),
            );
            return next;
          }
          case "tool_result": {
            const idx = prev.findIndex(
              (s) => s.kind === "tool" && s.id === event.id,
            );
            const toolInput =
              idx >= 0 && prev[idx]?.kind === "tool"
                ? (prev[idx] as Extract<AgentStep, { kind: "tool" }>).input
                : undefined;
            const glowKeys = computeTouchHighlightKeys(
              event.name,
              toolInput,
              event.result,
              event.isError,
            );
            queueMicrotask(() => pulseTouchGlow(glowKeys));

            if (idx >= 0) {
              const step = next[idx] as Extract<AgentStep, { kind: "tool" }>;
              next[idx] = {
                ...step,
                result: event.result,
                isError: event.isError,
              };
            }
            return next;
          }
          case "error": {
            next.push({ kind: "error", text: event.message });
            return next;
          }
          default:
            return next;
        }
      });
      if (event.type === "tool_result") {
        // Refetch board state so the UI reflects the new DB.
        invalidate();
        if (!event.isError && event.name === "navigate_ui") {
          const href = hrefFromNavigateUIResult(event.result);
          if (href) router.push(href);
        }
      }
    },
    [invalidate, pulseTouchGlow, router],
  );

  const send = React.useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || running) return;
      setSteps((prev) => [...prev, { kind: "user", text: trimmed }]);
      setRunning(true);
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        if (!res.ok || !res.body) {
          throw new Error(`Agent request failed: ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Parse SSE chunks: split on double newlines.
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const lines = part.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6);
              if (!json || json === "{}") continue;
              try {
                const ev = JSON.parse(json) as AgentEvent;
                handleEvent(ev);
              } catch {
                // ignore malformed chunk
              }
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSteps((prev) => [...prev, { kind: "error", text: msg }]);
      } finally {
        setRunning(false);
        invalidate();
      }
    },
    [handleEvent, invalidate, running],
  );

  const clear = React.useCallback(() => setSteps([]), []);

  const value = React.useMemo<Ctx>(
    () => ({
      steps,
      running,
      touchGlowKeys,
      touchGlowToken,
      send,
      clear,
    }),
    [steps, running, touchGlowKeys, touchGlowToken, send, clear],
  );

  return <AgentCtx.Provider value={value}>{children}</AgentCtx.Provider>;
}
