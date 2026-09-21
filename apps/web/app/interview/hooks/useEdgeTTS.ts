/**
 * useEdgeTTS.ts
 * Edge TTS via FastAPI + browser SpeechSynthesis fallback.
 * Pre-fetches and caches first-question audio for zero-latency playback.
 */
"use client";

import { useRef, useCallback } from "react";
import { fetchTTSAudio } from "../services/interviewService";

export function useEdgeTTS(
  audioCtxRef: React.MutableRefObject<AudioContext | null>,
  audioDestRef: React.MutableRefObject<MediaStreamAudioDestinationNode | null>
) {
  const firstQuestionAudioRef = useRef<AudioBuffer | null>(null);

  /** Decode raw ArrayBuffer into an AudioBuffer */
  const decodeBuffer = useCallback(
    async (arrayBuf: ArrayBuffer): Promise<AudioBuffer | null> => {
      try {
        let ctx = audioCtxRef.current;
        if (!ctx) {
          ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioCtxRef.current = ctx;
        }
        if (ctx.state === "suspended") await ctx.resume();
        return await ctx.decodeAudioData(arrayBuf);
      } catch {
        return null;
      }
    },
    [audioCtxRef]
  );

  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  /** Stop any currently playing speech */
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch {}
      activeSourceRef.current = null;
    }
  }, []);

  /** Play a pre-decoded AudioBuffer through speakers + recording destination */
  const playBuffer = useCallback(
    (buffer: AudioBuffer, text: string): Promise<void> => {
      return new Promise((resolve) => {
        stopSpeaking();
        const ctx = audioCtxRef.current!;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        if (audioDestRef.current) source.connect(audioDestRef.current);
        activeSourceRef.current = source;
        let done = false;
        const finish = () => { 
          if (!done) { 
            done = true; 
            if (activeSourceRef.current === source) activeSourceRef.current = null;
            resolve(); 
          } 
        };
        source.onended = finish;
        source.start(0);
        // Safety timeout: word count × 600 ms + 3 s buffer
        setTimeout(finish, text.trim().split(/\s+/).length * 600 + 3000);
      });
    },
    [audioCtxRef, audioDestRef, stopSpeaking]
  );

  /** Browser SpeechSynthesis fallback (voice NOT captured in recording) */
  const playSpeechSynthesis = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
      } catch {}

      const voices = window.speechSynthesis.getVoices();
      const voice =
        voices.find((v) => v.localService && v.lang.startsWith("en")) ||
        voices.find((v) =>
          /Zira|David|Mark|Aria/.test(v.name)
        ) ||
        voices.find((v) => v.lang.startsWith("en"));

      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.95;
      utt.pitch = 1.0;
      utt.volume = 1.0;
      if (voice) { utt.voice = voice; utt.lang = voice.lang; } else { utt.lang = "en-US"; }

      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      utt.onend = finish;
      utt.onerror = finish;
      window.speechSynthesis.speak(utt);
      setTimeout(finish, text.trim().split(/\s+/).length * 500 + 3000);
    });
  }, []);

  /**
   * speak — main entry point.
   * Priority: pre-fetched buffer → Edge TTS fetch → SpeechSynthesis fallback.
   */
  const speak = useCallback(
    async (text: string, prefetched?: AudioBuffer | null): Promise<void> => {
      // 1. Use pre-fetched buffer instantly (zero latency)
      if (prefetched) {
        try {
          let ctx = audioCtxRef.current;
          if (!ctx) {
            ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioCtxRef.current = ctx;
          }
          if (ctx.state === "suspended") await ctx.resume();
          return await playBuffer(prefetched, text);
        } catch {
          /* fall through */
        }
      }

      // 2. Fetch from Edge TTS
      const controller = new AbortController();
      const ttsTimeout = setTimeout(() => controller.abort(), 12000);
      try {
        const arrayBuf = await fetchTTSAudio(text, controller.signal);
        clearTimeout(ttsTimeout);
        if (arrayBuf) {
          const buffer = await decodeBuffer(arrayBuf);
          if (buffer) {
            let ctx = audioCtxRef.current;
            if (!ctx) {
              ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              audioCtxRef.current = ctx;
            }
            if (ctx.state === "suspended") await ctx.resume();
            return await playBuffer(buffer, text);
          }
        }
      } catch {
        clearTimeout(ttsTimeout);
      }

      // 3. Fallback
      console.warn("🔇 Using browser SpeechSynthesis fallback — voice will NOT appear in recording");
      return playSpeechSynthesis(text);
    },
    [audioCtxRef, audioDestRef, decodeBuffer, playBuffer, playSpeechSynthesis]
  );

  /** Warm up Edge TTS + pre-fetch first question audio on mount */
  const warmupAndPrefetch = useCallback(async (firstQuestionText: string) => {
    // Fire-and-forget warmup ping
    fetchTTSAudio("Aria warm up.").catch(() => {});

    try {
      const arrayBuf = await fetchTTSAudio(firstQuestionText);
      if (arrayBuf) {
        const buffer = await decodeBuffer(arrayBuf);
        if (buffer) {
          firstQuestionAudioRef.current = buffer;
          console.log("✅ [TTS Warmup] First question audio cached!");
        }
      }
    } catch {
      console.warn("⚠️ [TTS Warmup] Pre-fetch failed");
    }
  }, [decodeBuffer]);

  return { speak, stopSpeaking, warmupAndPrefetch, firstQuestionAudioRef };
}
