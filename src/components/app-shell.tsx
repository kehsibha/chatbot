"use client";
/**
 * Top-level client shell: sidebar + main + reasoning panel + voice orb.
 * Keeps view-level pages blissfully ignorant of chrome.
 */
import { Sidebar } from "@/components/sidebar";
import { ReasoningPanel } from "@/components/reasoning-panel";
import { VoiceOrb } from "@/components/voice-orb";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      <ReasoningPanel />
      <VoiceOrb />
    </div>
  );
}
