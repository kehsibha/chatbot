"use client";
/**
 * Left sidebar: primary navigation + a dynamic list of projects.
 * Collapses visually below a threshold but isn't dismissable (a tools
 * app sidebar is load-bearing).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Sun,
  FolderKanban,
  CalendarRange,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchProject, useProjects } from "@/lib/queries";
import { AgentProjectGlow } from "@/components/agent-touch-glow";

const primaryLinks = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/upcoming", label: "Upcoming", icon: CalendarRange },
];

export function Sidebar() {
  const pathname = usePathname();
  const qc = useQueryClient();
  const { data: projects } = useProjects();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex items-center gap-2 px-4 py-4">
        <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
        <span className="text-sm font-semibold tracking-tight">GTD</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {primaryLinks.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-fg)]",
                active &&
                  "bg-[var(--color-panel-2)] text-[var(--color-fg)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 flex min-h-0 flex-1 flex-col px-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
          Projects
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {(projects ?? [])
            .filter((p) => p.status === "active")
            .map((p) => {
              const href = `/projects/${p.id}`;
              const active = pathname === href;
              return (
                <Link
                  key={p.id}
                  href={href}
                  prefetch
                  onMouseEnter={() => prefetchProject(qc, p.id)}
                  onFocus={() => prefetchProject(qc, p.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-fg)]",
                    active &&
                      "bg-[var(--color-panel-2)] text-[var(--color-fg)]",
                  )}
                >
                  <AgentProjectGlow projectId={p.id} className="flex w-full min-w-0 items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: p.color ?? "#6366f1" }}
                    />
                    <span className="truncate">{p.title}</span>
                    {p.counts.next > 0 && (
                      <span className="ml-auto text-[10px] text-[var(--color-fg-dim)]">
                        {p.counts.next}
                      </span>
                    )}
                  </AgentProjectGlow>
                </Link>
              );
            })}
        </div>
      </div>
    </aside>
  );
}
