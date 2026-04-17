"use client";
/**
 * Single-project Kanban. Columns map to GTD action statuses:
 *   next | waiting | scheduled | done
 *
 * Drag between columns updates `status` via the REST API and
 * optimistically updates the cache. Drops are then reconciled when
 * the server response comes back.
 */
import * as React from "react";
import { useParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useProject, useUpdateAction } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { AgentActionGlow } from "@/components/agent-touch-glow";
import { cn } from "@/lib/utils";
import type { Action, ActionStatus } from "@/lib/db/schema";
import { Clock, Tag, Hourglass } from "lucide-react";

type KanbanStatus = Extract<
  ActionStatus,
  "next" | "waiting" | "scheduled" | "done"
>;

const COLUMNS: { key: KanbanStatus; label: string }[] = [
  { key: "next", label: "Next" },
  { key: "waiting", label: "Waiting" },
  { key: "scheduled", label: "Scheduled" },
  { key: "done", label: "Done" },
];

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading } = useProject(id);
  const update = useUpdateAction();
  const qc = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Loading…" />
      </div>
    );
  }

  const { project, actions } = data;

  const byColumn: Record<KanbanStatus, Action[]> = {
    next: [],
    waiting: [],
    scheduled: [],
    done: [],
  };
  for (const a of actions) {
    if (a.status in byColumn) byColumn[a.status as KanbanStatus].push(a);
  }
  for (const key of Object.keys(byColumn) as KanbanStatus[]) {
    byColumn[key].sort((a, b) => a.position - b.position);
  }

  const active = activeId ? actions.find((a) => a.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const actionId = String(active.id);
    // `over.id` is either a column key (when dropped on empty column) or
    // another action id (when dropped onto a card).
    const overId = String(over.id);
    const overColumn = (
      COLUMNS.find((c) => c.key === overId)?.key ??
      (actions.find((a) => a.id === overId)?.status as KanbanStatus | undefined)
    );
    if (!overColumn) return;
    const current = actions.find((a) => a.id === actionId);
    if (!current) return;
    if (current.status === overColumn) return;

    // Optimistic update in the cache.
    qc.setQueryData<{ project: typeof project; actions: Action[] }>(
      ["projects", id],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          actions: old.actions.map((a) =>
            a.id === actionId ? { ...a, status: overColumn } : a,
          ),
        };
      },
    );

    update.mutate({
      id: actionId,
      patch: { status: overColumn } as Partial<Action>,
    });
  };

  return (
    <div>
      <PageHeader
        title={project.title}
        subtitle={project.description ?? undefined}
      />
      <div className="px-6 py-6">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key}
                columnKey={col.key}
                label={col.label}
                actions={byColumn[col.key]}
              />
            ))}
          </div>
          <DragOverlay>
            {active ? <ActionCard action={active} dragging /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function KanbanColumn({
  columnKey,
  label,
  actions,
}: {
  columnKey: KanbanStatus;
  label: string;
  actions: Action[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[200px] flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3",
        isOver && "border-[var(--color-accent)]",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          {label}
        </span>
        <span className="text-[10px] text-[var(--color-fg-dim)]">
          {actions.length}
        </span>
      </div>
      <SortableContext
        items={actions.map((a) => a.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {actions.map((a) => (
            <SortableCard key={a.id} action={a} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({ action }: { action: Action }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: action.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ActionCard action={action} />
    </div>
  );
}

function ActionCard({
  action,
  dragging,
}: {
  action: Action;
  dragging?: boolean;
}) {
  return (
    <AgentActionGlow
      actionId={action.id}
      className={cn(
        "cursor-grab rounded-md border border-[var(--color-border)] bg-[var(--color-panel-2)] p-2 text-sm shadow-sm",
        dragging && "rotate-1 cursor-grabbing shadow-lg",
        action.isFirstAction && "border-l-2 border-l-[var(--color-accent)]",
      )}
    >
      <div className="text-sm">{action.title}</div>
      {(action.context || action.dueAt || action.delegatedTo) && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-fg-dim)]">
          {action.context && (
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3 w-3" /> {action.context}
            </span>
          )}
          {action.dueAt && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {format(new Date(action.dueAt), "MMM d")}
            </span>
          )}
          {action.delegatedTo && (
            <span className="inline-flex items-center gap-1 text-[var(--color-warn)]">
              <Hourglass className="h-3 w-3" /> {action.delegatedTo}
            </span>
          )}
        </div>
      )}
    </AgentActionGlow>
  );
}
