"use client";
/**
 * Custom hook wrapping the Web Speech API (SpeechRecognition).
 *
 * Returns live transcript strings and start/stop controls.
 * Handles the browser quirk where recognition auto-stops after
 * silence by restarting transparently while `isListening` is true.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseSpeechRecognitionReturn {
  /** Whether the browser supports the Speech Recognition API */
  isSupported: boolean;
  /** Whether we're actively listening */
  isListening: boolean;
  /** Accumulated finalized transcript for the current session */
  transcript: string;
  /** In-progress (not yet finalized) text — updates rapidly */
  interimTranscript: string;
  /** Start listening */
  start: () => void;
  /** Stop listening */
  stop: () => void;
  /** Clear transcript and interim text */
  reset: () => void;
  /** Last error message, if any */
  error: string | null;
}

const IS_SUPPORTED =
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

function createRecognition(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.continuous = true;
  r.interimResults = true;
  r.lang = "en-US";
  r.maxAlternatives = 1;
  return r;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Persist across renders; lazily created.
  const recRef = useRef<SpeechRecognition | null>(null);
  // Track whether the user explicitly wants listening active.
  const wantListening = useRef(false);

  useEffect(() => {
    if (!IS_SUPPORTED) return;
    const rec = createRecognition();
    if (!rec) return;
    recRef.current = rec;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        setTranscript((prev) => (prev ? prev + " " + final.trim() : final.trim()));
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // "aborted" and "no-speech" are normal — don't surface them.
      if (e.error === "aborted" || e.error === "no-speech") return;
      setError(e.error);
      setIsListening(false);
      wantListening.current = false;
    };

    rec.onend = () => {
      // Browser killed recognition after silence. Restart if the
      // user still wants to be listening.
      if (wantListening.current) {
        try {
          rec.start();
        } catch {
          // Already started — ignore.
        }
      } else {
        setIsListening(false);
      }
    };

    return () => {
      wantListening.current = false;
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  const start = useCallback(() => {
    setError(null);
    const rec = recRef.current;
    if (!rec) return;
    wantListening.current = true;
    setIsListening(true);
    try {
      rec.start();
    } catch {
      // Already started — ignore.
    }
  }, []);

  const stop = useCallback(() => {
    wantListening.current = false;
    setIsListening(false);
    setInterimTranscript("");
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      /* noop */
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    isSupported: IS_SUPPORTED,
    isListening,
    transcript,
    interimTranscript,
    start,
    stop,
    reset,
    error,
  };
}
