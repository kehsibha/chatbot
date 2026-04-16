"use client";
/**
 * Top-level client shell: sidebar + main + (optional) reasoning panel + bottom agent bar.
 * Keeps view-level pages blissfully ignorant of chrome.
 */
import * as React from "react";
import { Sidebar } from "@/components/sidebar";
import { AgentBar } from "@/components/agent-bar";
import { ReasoningPanel } from "@/components/reasoning-panel";
import { VoiceOrb } from "@/components/voice-orb";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [showReasoning, setShowReasoning] = React.useState(true);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
        <AgentBar
          showReasoning={showReasoning}
          onToggleReasoning={() => setShowReasoning((s) => !s)}
        />
      </div>
      {showReasoning && <ReasoningPanel />}
      <VoiceOrb />
    </div>
  );
}
