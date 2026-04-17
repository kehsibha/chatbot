"use client";
/**
 * Top-level client shell: sidebar + main + (optional) reasoning panel + voice orb.
 * Keeps view-level pages blissfully ignorant of chrome.
 */
import * as React from "react";
import { Sidebar } from "@/components/sidebar";
import { ReasoningPanel } from "@/components/reasoning-panel";
import { VoiceOrb } from "@/components/voice-orb";
import {
  AgentRegionGlow,
  AgentRouteGlow,
} from "@/components/agent-touch-glow";
import { AgentControlHalo } from "@/components/agent-control-halo";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [showReasoning, setShowReasoning] = React.useState(false);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      <AgentControlHalo />
      <AgentRegionGlow region="sidebar">
        <Sidebar />
      </AgentRegionGlow>
      <AgentRouteGlow className="min-w-0 flex-1 overflow-y-auto">
        <main className="min-h-full">{children}</main>
      </AgentRouteGlow>
      {showReasoning && <ReasoningPanel />}
      <AgentRegionGlow region="voice">
        <VoiceOrb
          showReasoning={showReasoning}
          onToggleReasoning={() => setShowReasoning((s) => !s)}
        />
      </AgentRegionGlow>
    </div>
  );
}
