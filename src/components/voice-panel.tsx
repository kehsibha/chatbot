"use client";
/**
 * Voice session panel: chronological turns (you → agent), markdown reply,
 * collapsible gray "Activity" for thinking + tool calls. Scroll sticks to bottom.
 */
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { X, Send, ChevronDown } from "lucide-react";
import { useAgent, type AgentStep } from "@/components/agent-context";
import { cn } from "@/lib/utils";

type TurnBlock = {
  userText: string;
  tail: AgentStep[];
};

function buildTurnBlocks(steps: AgentStep[]): TurnBlock[] {
  const blocks: TurnBlock[] = [];
  for (const step of steps) {
    if (step.kind === "user") {
      blocks.push({ userText: step.text, tail: [] });
    } else {
      if (blocks.length === 0) {
        blocks.push({ userText: "", tail: [step] });
      } else {
        blocks[blocks.length - 1].tail.push(step);
      }
    }
  }
  return blocks;
}

function messageFromTail(tail: AgentStep[]): string {
  const parts: string[] = [];
  for (const s of tail) {
    if (s.kind === "message") parts.push(s.text);
  }
  return parts.join("");
}

function activityFromTail(tail: AgentStep[]): AgentStep[] {
  return tail.filter(
    (s) => s.kind === "thinking" || s.kind === "tool" || s.kind === "error",
  );
}

function ActivityDetails({ items }: { items: AgentStep[] }) {
  if (items.length === 0) return null;
  return (
    <details className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-2)]/80">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-fg-dim)] [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
        <span>
          Activity
          <span className="ml-1 font-normal text-[var(--color-fg-dim)]/80">
            ({items.length})
          </span>
        </span>
      </summary>
      <div className="space-y-2 border-t border-[var(--color-border)]/60 px-2.5 py-2">
        {items.map((s, i) => (
          <ActivityRow key={i} step={s} />
        ))}
      </div>
    </details>
  );
}

function ActivityRow({ step }: { step: AgentStep }) {
  if (step.kind === "thinking") {
    return (
      <div>
        <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-fg-dim)]">
          Thinking
        </div>
        <p className="max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-snug text-[var(--color-fg-muted)]">
          {step.text || "…"}
        </p>
      </div>
    );
  }
  if (step.kind === "error") {
    return (
      <p className="text-[10px] text-[var(--color-danger)]">{step.text}</p>
    );
  }
  if (step.kind === "tool") {
    const done = step.result !== undefined;
    return (
      <div className="rounded border border-[var(--color-border)]/80 bg-[var(--color-panel)] px-2 py-1.5">
        <div className="mb-0.5 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-[var(--color-fg-dim)]">
          <span className="font-mono text-[var(--color-fg-muted)]">{step.name}</span>
          <span className="ml-auto text-[var(--color-fg-dim)]">
            {done ? (step.isError ? "error" : "done") : "…"}
          </span>
        </div>
        <pre className="max-h-20 overflow-y-auto font-mono text-[9px] text-[var(--color-fg-muted)]">
          {JSON.stringify(step.input, null, 2)}
        </pre>
      </div>
    );
  }
  return null;
}

export function VoicePanel({
  transcript,
  interimTranscript,
  onClose,
  onSend,
}: {
  transcript: string;
  interimTranscript: string;
  onClose: () => void;
  onSend: () => void;
}) {
  const { steps, running } = useAgent();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const blocks = React.useMemo(() => buildTurnBlocks(steps), [steps]);
  const hasLiveDraft = !!(transcript || interimTranscript);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [steps, transcript, interimTranscript, running]);

  return (
    <div className="animate-voice-panel-in fixed bottom-[5.75rem] right-6 z-[60] flex w-[min(100vw-3rem,22rem)] max-h-[min(70vh,32rem)] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-[11px] font-medium text-[var(--color-fg-muted)]">
          {running ? "Agent on…" : "Voice"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-[var(--color-fg-dim)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-fg)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-3 py-3"
      >
        {blocks.length === 0 && !hasLiveDraft && (
          <p className="py-6 text-center text-[11px] text-[var(--color-fg-dim)]">
            Speak, then send — your thread builds here.
          </p>
        )}

        {blocks.map((b, bi) => {
          const msg = messageFromTail(b.tail);
          const activity = activityFromTail(b.tail);
          const isLast = bi === blocks.length - 1;
          return (
            <div key={bi} className="flex flex-col gap-2">
              {b.userText ? (
                <div className="rounded-xl bg-[var(--color-panel-2)] px-2.5 py-2">
                  <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-fg-dim)]">
                    You
                  </div>
                  <p className="text-[13px] leading-snug text-[var(--color-fg)]">
                    {b.userText}
                  </p>
                </div>
              ) : null}

              {msg ? (
                <div className="rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-panel)] px-2.5 py-2">
                  <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-fg-dim)]">
                    Agent
                  </div>
                  <div className="voice-md">
                    <ReactMarkdown>{msg}</ReactMarkdown>
                  </div>
                  {isLast && running && (
                    <span className="mt-1 inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-[var(--color-accent)]" />
                  )}
                </div>
              ) : isLast && running ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] px-2.5 py-2 text-[11px] text-[var(--color-fg-dim)]">
                  Working…
                </div>
              ) : null}

              <ActivityDetails items={activity} />
            </div>
          );
        })}

        {hasLiveDraft && (
          <div className="rounded-xl bg-[var(--color-accent-light)] px-2.5 py-2">
            <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
              Draft
            </div>
            <p className="text-[13px] leading-snug text-[var(--color-fg)]">
              {transcript}
              {interimTranscript ? (
                <span className="text-[var(--color-fg-muted)]">
                  {transcript ? " " : ""}
                  {interimTranscript}
                </span>
              ) : null}
            </p>
          </div>
        )}
      </div>

      {hasLiveDraft && !running && (
        <div className="shrink-0 border-t border-[var(--color-border)] px-3 py-2">
          <button
            type="button"
            onClick={onSend}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium",
              "bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90",
            )}
          >
            <Send className="h-3 w-3" />
            Send to agent
          </button>
        </div>
      )}
    </div>
  );
}
