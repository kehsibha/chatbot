"use client";
/**
 * Upcoming view — a simple time-grouped list of scheduled / due actions.
 * Intentionally minimal; will be replaced with a calendar integration later.
 */
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import { useActions, useProjects } from "@/lib/queries";
import { ActionRow } from "@/components/action-row";
import { PageHeader } from "@/components/page-header";
import type { Action } from "@/lib/db/schema";

type Bucket = { label: string; items: Action[] };

function bucketize(actions: Action[]): Bucket[] {
  const buckets: Record<string, Action[]> = {
    Today: [],
    Tomorrow: [],
    "This week": [],
    Later: [],
  };
  const withDate = actions
    .filter((a) => a.status !== "done" && (a.dueAt || a.scheduledAt))
    .sort((a, b) => {
      const aD = new Date(a.dueAt ?? a.scheduledAt!).getTime();
      const bD = new Date(b.dueAt ?? b.scheduledAt!).getTime();
      return aD - bD;
    });
  for (const a of withDate) {
    const d = new Date((a.dueAt ?? a.scheduledAt)!);
    if (isToday(d)) buckets.Today.push(a);
    else if (isTomorrow(d)) buckets.Tomorrow.push(a);
    else if (isThisWeek(d)) buckets["This week"].push(a);
    else buckets.Later.push(a);
  }
  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export default function UpcomingPage() {
  const { data: actions = [], isLoading } = useActions();
  const { data: projects = [] } = useProjects();
  const projectMap = new Map(projects.map((p) => [p.id, p.title]));
  const buckets = bucketize(actions);

  return (
    <div>
      <PageHeader
        title="Upcoming"
        subtitle={format(new Date(), "EEEE, MMMM d")}
      />
      <div className="mx-auto max-w-3xl px-6 py-6">
        {isLoading && (
          <div className="text-xs text-[var(--color-fg-dim)]">Loading…</div>
        )}
        {!isLoading && buckets.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--color-border)] px-6 py-10 text-center text-sm text-[var(--color-fg-muted)]">
            No scheduled actions.
          </div>
        )}
        <div className="flex flex-col gap-6">
          {buckets.map((b) => (
            <section key={b.label}>
              <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                {b.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {b.items.map((a) => (
                  <ActionRow
                    key={a.id}
                    action={a}
                    projectTitle={
                      a.projectId ? projectMap.get(a.projectId) : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
