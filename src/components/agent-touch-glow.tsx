"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useAgent } from "@/components/agent-context";
import { cn } from "@/lib/utils";

function routeMatches(pathname: string | null, routeKey: string): boolean {
  if (!pathname) return false;
  const path = routeKey.replace(/^route:/, "");
  if (path === "/projects") {
    return pathname === "/projects" || pathname.startsWith("/projects/");
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function useRestartGlowAnimation(
  active: boolean,
  touchGlowToken: number,
  ref: React.RefObject<HTMLElement | null>,
) {
  const prevToken = React.useRef<number | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!active) {
      el.classList.remove("agent-touch-glow");
      prevToken.current = null;
      return;
    }
    if (prevToken.current === touchGlowToken) return;
    prevToken.current = touchGlowToken;
    el.classList.remove("agent-touch-glow");
    void el.offsetWidth;
    el.classList.add("agent-touch-glow");
  }, [active, touchGlowToken, ref]);
}

export function AgentRegionGlow({
  region,
  className,
  children,
}: {
  region:
    | "sidebar"
    | "today"
    | "inbox"
    | "projects"
    | "upcoming"
    | "reasoning"
    | "voice";
  className?: string;
  children: React.ReactNode;
}) {
  const { touchGlowKeys, touchGlowToken } = useAgent();
  const active = touchGlowKeys.includes(`region:${region}`);
  const ref = React.useRef<HTMLDivElement>(null);
  useRestartGlowAnimation(active, touchGlowToken, ref);

  return (
    <div
      ref={ref}
      className={cn(className, active && "agent-touch-glow")}
      data-agent-region={region}
    >
      {children}
    </div>
  );
}

export function AgentRouteGlow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { touchGlowKeys, touchGlowToken } = useAgent();
  const pathname = usePathname();
  const active = React.useMemo(() => {
    for (const k of touchGlowKeys) {
      if (k.startsWith("route:") && routeMatches(pathname, k)) return true;
    }
    return false;
  }, [touchGlowKeys, pathname]);
  const ref = React.useRef<HTMLDivElement>(null);
  useRestartGlowAnimation(active, touchGlowToken, ref);

  return (
    <div ref={ref} className={cn(className, active && "agent-touch-glow")}>
      {children}
    </div>
  );
}

export function AgentProjectGlow({
  projectId,
  className,
  children,
}: {
  projectId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { touchGlowKeys, touchGlowToken } = useAgent();
  const pathname = usePathname();
  const active = React.useMemo(() => {
    if (touchGlowKeys.includes(`project:${projectId}`)) return true;
    const routeKey = `route:/projects/${projectId}`;
    if (!touchGlowKeys.includes(routeKey)) return false;
    return (
      pathname === `/projects/${projectId}` ||
      pathname?.startsWith(`/projects/${projectId}/`) === true
    );
  }, [touchGlowKeys, pathname, projectId]);
  const ref = React.useRef<HTMLDivElement>(null);
  useRestartGlowAnimation(active, touchGlowToken, ref);

  return (
    <div
      ref={ref}
      className={cn(className, active && "agent-touch-glow")}
      data-agent-project={projectId}
    >
      {children}
    </div>
  );
}

export function AgentActionGlow({
  actionId,
  className,
  children,
}: {
  actionId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { touchGlowKeys, touchGlowToken } = useAgent();
  const active = touchGlowKeys.includes(`action:${actionId}`);
  const ref = React.useRef<HTMLDivElement>(null);
  useRestartGlowAnimation(active, touchGlowToken, ref);

  return (
    <div
      ref={ref}
      className={cn(className, active && "agent-touch-glow")}
      data-agent-action={actionId}
    >
      {children}
    </div>
  );
}
