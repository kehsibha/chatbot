"use client";

import * as React from "react";
import { useAgent } from "@/components/agent-context";
import { cn } from "@/lib/utils";

/**
 * Full-viewport ring while the agent is running — subtle "system is acting" cue.
 * pointer-events-none so the user can still click the app.
 */
export function AgentControlHalo() {
  const { running } = useAgent();
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-[40] transition-opacity duration-300",
        running ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className={cn(
          "absolute inset-3 rounded-xl border-2 border-transparent",
          running && "agent-app-halo",
        )}
      />
    </div>
  );
}
