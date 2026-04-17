"use client";
/**
 * Row representation of an action. Used in Today, Inbox, and filtered lists.
 * Clicking the checkbox marks the action done (optimistic via mutation).
 */
import * as React from "react";
import { format, isToday, isPast } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useUpdateAction } from "@/lib/queries";
import type { Action } from "@/lib/db/schema";
import { Clock, Hourglass, Tag } from "lucide-react";
import { AgentActionGlow } from "@/components/agent-touch-glow";

export function ActionRow({
  action,
  projectTitle,
}: {
  action: Action;
  projectTitle?: string;
}) {
  const update = useUpdateAction();
  const done = action.status === "done";

  const toggle = () => {
    update.mutate({
      id: action.id,
      patch: { status: done ? "next" : "done" } as Partial<Action>,
    });
  };

  const due = action.dueAt ? new Date(action.dueAt) : null;
  const overdue = due != null && isPast(due) && !isToday(due);

  return (
    <AgentActionGlow
      actionId={action.id}
      className={cn(
        "group flex items-start gap-3 rounded-md border border-transparent px-3 py-2 hover:border-[var(--color-border)] hover:bg-[var(--color-panel-2)]",
        done && "opacity-50",
      )}
    >
      <div className="pt-0.5">
        <Checkbox checked={done} onCheckedChange={toggle} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm", done && "line-through")}>
          {action.title}
        </div>
        {action.notes && (
          <div className="mt-0.5 truncate text-xs text-[var(--color-fg-muted)]">
            {action.notes}
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-fg-dim)]">
          {projectTitle && (
            <span className="rounded bg-[var(--color-panel-2)] px-1.5 py-0.5">
              {projectTitle}
            </span>
          )}
          {action.context && (
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {action.context}
            </span>
          )}
          {due && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue && "text-[var(--color-danger)]",
                isToday(due) && "text-[var(--color-warn)]",
              )}
            >
              <Clock className="h-3 w-3" />
              {format(due, "MMM d")}
            </span>
          )}
          {action.status === "waiting" && action.delegatedTo && (
            <span className="inline-flex items-center gap-1 text-[var(--color-warn)]">
              <Hourglass className="h-3 w-3" />
              {action.delegatedTo}
            </span>
          )}
        </div>
      </div>
    </AgentActionGlow>
  );
}
