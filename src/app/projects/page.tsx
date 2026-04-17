"use client";
/**
 * Projects index — grid of project cards with progress and counts.
 */
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchProject, useProjects } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useProjects();

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Outcomes that take more than one action."
      />
      <div className="mx-auto max-w-5xl px-6 py-6">
        {isLoading && (
          <div className="text-xs text-[var(--color-fg-dim)]">Loading…</div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const pct =
              p.counts.total > 0
                ? Math.round((p.counts.done / p.counts.total) * 100)
                : 0;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                prefetch
                onMouseEnter={() => prefetchProject(qc, p.id)}
                onFocus={() => prefetchProject(qc, p.id)}
              >
                <Card className="cursor-pointer p-4 transition-colors hover:border-[var(--color-border-strong)]">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: p.color ?? "#6366f1" }}
                    />
                    <span className="text-sm font-semibold">{p.title}</span>
                    <span
                      className={cn(
                        "ml-auto text-[10px] uppercase tracking-wider",
                        p.status === "active" && "text-[var(--color-ok)]",
                        p.status === "on_hold" && "text-[var(--color-warn)]",
                        p.status === "someday" && "text-[var(--color-fg-dim)]",
                        p.status === "done" && "text-[var(--color-fg-dim)]",
                      )}
                    >
                      {p.status}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mb-3 line-clamp-2 text-xs text-[var(--color-fg-muted)]">
                      {p.description}
                    </p>
                  )}
                  <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--color-fg-dim)]">
                    <span>
                      {p.counts.done} / {p.counts.total} done
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[var(--color-panel-2)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)] transition-[width]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex gap-3 text-[11px] text-[var(--color-fg-muted)]">
                    <span>{p.counts.next} next</span>
                    <span>{p.counts.waiting} waiting</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
