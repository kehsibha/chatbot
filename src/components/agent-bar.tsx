"use client";
/**
 * Bottom-pinned chat bar. Minimal by design — a single textarea that
 * expands on focus, plus a submit button. Pressing Enter sends;
 * Shift+Enter inserts a newline.
 */
import * as React from "react";
import { ArrowUp, Loader2, Sparkles, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgent } from "@/components/agent-context";
import { cn } from "@/lib/utils";

export function AgentBar({
  showReasoning,
  onToggleReasoning,
}: {
  showReasoning: boolean;
  onToggleReasoning: () => void;
}) {
  const { send, running } = useAgent();
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim() || running) return;
    const msg = value;
    setValue("");
    await send(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-size textarea.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3"
    >
      <div className="mx-auto flex max-w-4xl items-end gap-2">
        <div className="flex-1 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-panel-2)] px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--color-fg-dim)]">
            <Sparkles className="h-3 w-3" />
            <span>Talk to your GTD coach — capture, clarify, or ask what&apos;s next</span>
          </div>
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            placeholder="I need to call the dentist tomorrow and prep for the Q3 review..."
            className={cn(
              "block w-full resize-none bg-transparent text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none",
            )}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleReasoning}
          title={showReasoning ? "Hide reasoning panel" : "Show reasoning panel"}
        >
          {showReasoning ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>
        <Button
          type="submit"
          size="icon"
          disabled={running || !value.trim()}
          title="Send (Enter)"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
