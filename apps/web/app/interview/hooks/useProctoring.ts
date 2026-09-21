/**
 * useProctoring.ts
 * Handles tab-switch detection, elapsed session timer,
 * and violation logging for the interview room.
 */
"use client";

import { useState, useRef, useEffect } from "react";

export interface ViolationEntry {
  type: string;
  message: string;
  timestamp: string;
  question_number: number;
}

export interface UseProctoringReturn {
  violationCount: number;
  violationWarning: string | null;
  dismissWarning: () => void;
  elapsedSeconds: number;
  violationLogRef: React.MutableRefObject<ViolationEntry[]>;
  currentQuestionNumRef: React.MutableRefObject<number>;
  formatTime: (s: number) => string;
  pushViolation: (type: string, message: string) => void;
}

export function useProctoring(phase: string): UseProctoringReturn {
  const [violationCount, setViolationCount] = useState(0);
  const [violationWarning, setViolationWarning] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const violationLogRef = useRef<ViolationEntry[]>([]);
  const currentQuestionNumRef = useRef<number>(0);

  const isActivePhase =
    phase === "segment_1" ||
    phase === "segment_2" ||
    phase === "segment_3" ||
    phase === "segment_4";

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActivePhase) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isActivePhase]);

  // ── Tab-switch proctoring ─────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.hidden &&
        isActivePhase
      ) {
        const entry: ViolationEntry = {
          type: "tab_switch",
          message: "Candidate switched away from the interview tab",
          timestamp: new Date().toISOString(),
          question_number: currentQuestionNumRef.current,
        };
        violationLogRef.current.push(entry);
        setViolationCount((c) => c + 1);
        setViolationWarning("Tab switch detected! Please remain on the interview page.");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [phase]);

  // ── MediaPipe violation callback (called from parent) ─────────────────────
  // Exposed so the parent can push violations from useMediaPipe
  const pushViolation = (type: string, message: string) => {
    violationLogRef.current.push({
      type,
      message,
      timestamp: new Date().toISOString(),
      question_number: currentQuestionNumRef.current,
    });
    setViolationCount((c) => c + 1);
    setViolationWarning(message);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return {
    violationCount,
    violationWarning,
    dismissWarning: () => setViolationWarning(null),
    elapsedSeconds,
    violationLogRef,
    currentQuestionNumRef,
    formatTime,
    pushViolation,
  };
}
