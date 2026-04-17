"use client";
/**
 * Voice orb — small floating circle (bottom-right) that activates the
 * browser microphone, streams transcription live, and sends the result
 * to the agent. Inspired by Granola's always-present mic circle.
 *
 * States: idle → listening → processing → responding → idle
 *
 * Keyboard shortcut: Ctrl+Shift+V toggles listening.
 */
import * as React from "react";
import { Mic, Loader2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgent } from "@/components/agent-context";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { VoicePanel } from "@/components/voice-panel";

type OrbState = "idle" | "listening" | "processing" | "responding";

export function VoiceOrb({
  showReasoning,
  onToggleReasoning,
}: {
  showReasoning: boolean;
  onToggleReasoning: () => void;
}) {
  const { send, running } = useAgent();
  const speech = useSpeechRecognition();

  const [expanded, setExpanded] = React.useState(false);
  const [orbState, setOrbState] = React.useState<OrbState>("idle");

  // Derive `responding` from the agent's running flag.
  React.useEffect(() => {
    if (running && orbState === "processing") {
      setOrbState("responding");
    }
    if (!running && orbState === "responding") {
      setOrbState("idle");
    }
  }, [running, orbState]);

  // ── Keyboard shortcut: Ctrl+Shift+V ──
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        // Don't toggle voice if user is focused in a textarea/input.
        const tag = (document.activeElement?.tagName ?? "").toLowerCase();
        if (tag === "textarea" || tag === "input") return;
        toggle();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbState, speech.isListening]);

  function toggle() {
    if (orbState === "idle") {
      startListening();
    } else if (orbState === "listening") {
      submitTranscript();
    }
  }

  function startListening() {
    speech.reset();
    speech.start();
    setOrbState("listening");
    setExpanded(true);
  }

  function submitTranscript() {
    speech.stop();
    const text = (speech.transcript + " " + speech.interimTranscript).trim();
    if (text) {
      setOrbState("processing");
      send(text);
    } else {
      setOrbState("idle");
    }
    // Don't close panel — let it show the agent response.
  }

  function handleClose() {
    if (speech.isListening) speech.stop();
    setExpanded(false);
    if (orbState === "listening") setOrbState("idle");
  }

  function handleOrbClick() {
    if (orbState === "idle") {
      startListening();
    } else if (orbState === "listening") {
      submitTranscript();
    } else if (orbState === "responding" || orbState === "processing") {
      // Toggle panel visibility while agent works.
      setExpanded((prev) => !prev);
    }
  }

  if (!speech.isSupported) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={onToggleReasoning}
          title={showReasoning ? "Hide reasoning" : "Show reasoning"}
          aria-pressed={showReasoning}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-all duration-200",
            showReasoning
              ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
              : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]",
          )}
        >
          <Brain className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Expanded transcript panel — sits above the dock */}
      {expanded && (
        <VoicePanel
          transcript={speech.transcript}
          interimTranscript={speech.interimTranscript}
          onClose={handleClose}
          onSend={submitTranscript}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleReasoning}
          title={showReasoning ? "Hide reasoning" : "Show reasoning"}
          aria-pressed={showReasoning}
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-lg transition-all duration-200",
            showReasoning
              ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
              : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]",
          )}
        >
          <Brain className="h-5 w-5" />
        </button>

        {/* Mic — primary capture */}
        <button
          type="button"
          onClick={handleOrbClick}
          aria-label={
            orbState === "idle"
              ? "Start voice input"
              : orbState === "listening"
                ? "Send voice message"
                : "Toggle voice panel"
          }
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg transition-all duration-200",
            // Idle
            orbState === "idle" &&
              "bg-[var(--color-accent)] text-white hover:scale-105 hover:shadow-xl",
            // Listening — accent bg with breathing ring
            orbState === "listening" &&
              "bg-[var(--color-accent)] text-white scale-105",
            // Processing / responding
            (orbState === "processing" || orbState === "responding") &&
              "border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-accent)]",
          )}
        >
          {orbState === "listening" && (
            <>
              <span className="animate-voice-breathe absolute inset-0 rounded-full bg-[var(--color-accent)] opacity-40" />
              <span
                className="animate-voice-breathe absolute inset-0 rounded-full bg-[var(--color-accent)] opacity-20"
                style={{ animationDelay: "0.4s" }}
              />
            </>
          )}

          {(orbState === "processing" || orbState === "responding") && (
            <span className="animate-voice-orbit absolute inset-[-3px] rounded-full border-2 border-transparent border-t-[var(--color-accent)]" />
          )}

          <span className="relative z-10">
            {orbState === "processing" || orbState === "responding" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </span>
        </button>
      </div>
    </>
  );
}
