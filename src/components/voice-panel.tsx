"use client";
/**
 * Floating transcript + agent response panel that appears above the voice orb.
 * Shows the user's live transcription and the agent's streaming reply.
 */
import * as React from "react";
import { X, Send } from "lucide-react";
import { useAgent, type AgentStep } from "@/components/agent-context";
import { cn } from "@/lib/utils";

function latestMessage(steps: AgentStep[]): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "message") return (steps[i] as { kind: "message"; text: string }).text;
  }
  return "";
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
  const reply = latestMessage(steps);

  // Auto-scroll as content streams in.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript, interimTranscript, reply]);

  const hasTranscript = !!(transcript || interimTranscript);

  return (
    <div className="animate-voice-panel-in fixed bottom-[5.75rem] right-6 z-50 flex w-[360px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <span className="text-xs font-medium text-[var(--color-fg-muted)]">
          {running ? "Agent responding…" : "Voice"}
        </span>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-[var(--color-fg-dim)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-fg)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div
        ref={scrollRef}
        className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-4 py-3"
      >
        {/* User transcript */}
        {hasTranscript && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              You
            </span>
            <p className="text-sm leading-relaxed text-[var(--color-fg)]">
              {transcript}
              {interimTranscript && (
                <span className="text-[var(--color-fg-dim)]">
                  {transcript ? " " : ""}
                  {interimTranscript}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Agent reply */}
        {reply && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              Agent
            </span>
            <p className="text-sm leading-relaxed text-[var(--color-fg)]">
              {reply}
              {running && (
                <span className="ml-1 inline-block h-2 w-2 animate-pulse-soft rounded-full bg-[var(--color-accent)]" />
              )}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!hasTranscript && !reply && (
          <p className="py-4 text-center text-xs text-[var(--color-fg-dim)]">
            Start speaking — your words will appear here.
          </p>
        )}
      </div>

      {/* Footer — send button */}
      {hasTranscript && !running && (
        <div className="border-t border-[var(--color-border)] px-4 py-2">
          <button
            onClick={onSend}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
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
