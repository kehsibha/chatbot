"use client";
/**
 * Right-side reasoning panel. Shows the agent's live chain-of-thought,
 * tool calls, and final assistant messages as they stream in.
 *
 * This is where the "visible agency" lives — watching the model think,
 * decide which tool to call, and see the result is the entire point.
 */
import * as React from "react";
import {
  Brain,
  MessageSquare,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  User as UserIcon,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgent, type AgentStep } from "@/components/agent-context";
import { cn } from "@/lib/utils";

export function ReasoningPanel() {
  const { steps, running, clear } = useAgent();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [steps, running]);

  return (
    <aside className="flex h-full w-96 flex-col border-l border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">Reasoning</span>
          {running && (
            <span className="ml-1 rounded-full bg-[var(--color-accent)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)] animate-pulse-soft">
              thinking
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={clear}
          title="Clear"
          disabled={running || steps.length === 0}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {steps.length === 0 && !running && (
          <div className="mt-10 text-center text-xs text-[var(--color-fg-dim)]">
            <Brain className="mx-auto mb-2 h-6 w-6 opacity-40" />
            <p>
              The agent&apos;s chain-of-thought will stream here as it works.
            </p>
          </div>
        )}
        {steps.map((step, i) => (
          <StepBlock key={i} step={step} />
        ))}
      </div>
    </aside>
  );
}

function StepBlock({ step }: { step: AgentStep }) {
  switch (step.kind) {
    case "user":
      return (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel-2)] px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-dim)]">
            <UserIcon className="h-3 w-3" /> You
          </div>
          <div className="whitespace-pre-wrap text-sm text-[var(--color-fg)]">
            {step.text}
          </div>
        </div>
      );
    case "thinking":
      return (
        <div className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-dim)]">
            <Brain className="h-3 w-3" /> Thinking
          </div>
          <div className="whitespace-pre-wrap font-mono text-xs text-[var(--color-fg-muted)]">
            {step.text}
          </div>
        </div>
      );
    case "message":
      return (
        <div className="rounded-md px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-dim)]">
            <MessageSquare className="h-3 w-3" /> Claude
          </div>
          <div className="whitespace-pre-wrap text-sm text-[var(--color-fg)]">
            {step.text}
          </div>
        </div>
      );
    case "tool": {
      const done = step.result !== undefined;
      const error = step.isError;
      return (
        <div
          className={cn(
            "rounded-md border px-3 py-2",
            error
              ? "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5"
              : "border-[var(--color-border)] bg-[var(--color-panel-2)]",
          )}
        >
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-dim)]">
            <Wrench className="h-3 w-3" />
            <span className="font-mono">{step.name}</span>
            {done ? (
              error ? (
                <AlertTriangle className="ml-auto h-3 w-3 text-[var(--color-danger)]" />
              ) : (
                <CheckCircle2 className="ml-auto h-3 w-3 text-[var(--color-ok)]" />
              )
            ) : (
              <span className="ml-auto animate-pulse-soft text-[var(--color-accent)]">
                running…
              </span>
            )}
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-[var(--color-fg-muted)]">
            {JSON.stringify(step.input, null, 2)}
          </pre>
          {done && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]">
                result
              </summary>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-[var(--color-fg-muted)]">
                {typeof step.result === "string"
                  ? step.result
                  : JSON.stringify(step.result, null, 2)}
              </pre>
            </details>
          )}
        </div>
      );
    }
    case "error":
      return (
        <div className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 px-3 py-2 text-xs text-[var(--color-danger)]">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
            <AlertTriangle className="h-3 w-3" /> Error
          </div>
          <div className="whitespace-pre-wrap">{step.text}</div>
        </div>
      );
  }
}
