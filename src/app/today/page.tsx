"use client";
/**
 * Today view — the default landing page. Shows everything due/scheduled
 * for today or overdue, plus a quick "recent inbox" peek and project heads.
 */
import { format } from "date-fns";
import { useActions, useProjects } from "@/lib/queries";
import { ActionRow } from "@/components/action-row";
import { PageHeader } from "@/components/page-header";

export default function TodayPage() {
  const { data: today = [], isLoading } = useActions({ view: "today" });
  const { data: projects = [] } = useProjects();
  const projectMap = new Map(projects.map((p) => [p.id, p.title]));

  return (
    <div>
      <PageHeader
        title="Today"
        subtitle={format(new Date(), "EEEE, MMMM d")}
      />
      <div className="mx-auto max-w-3xl px-6 py-6">
        {isLoading && (
          <div className="text-xs text-[var(--color-fg-dim)]">Loading…</div>
        )}
        {!isLoading && today.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--color-border)] px-6 py-10 text-center text-sm text-[var(--color-fg-muted)]">
            Nothing due today. Use the bar below to capture or ask the agent
            what you should do next.
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {today.map((a) => (
            <ActionRow
              key={a.id}
              action={a}
              projectTitle={
                a.projectId ? projectMap.get(a.projectId) : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
