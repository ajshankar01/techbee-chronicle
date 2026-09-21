/**
 * useSpeechRecognition.ts
 * Manages browser SpeechRecognition (Solution 1: instant client-side STT)
 * + FastAPI WebSocket streaming transcription (Solution 2: server-side accuracy).
 * Both update liveTranscriptText; WS messages de-duplicate against existing text.
 */
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { buildTranscribeWsUrl } from "../services/interviewService";

export interface UseSpeechRecognitionReturn {
  liveTranscriptText: string;
  setLiveTranscriptText: React.Dispatch<React.SetStateAction<string>>;
  interimTranscript: string;
  isListening: boolean;
  startLiveTranscription: () => void;
  stopLiveTranscription: () => void;
}

export function useSpeechRecognition(
  phase: string,
  micEnabled: boolean,
  sessionId: string,
  streamRef: React.RefObject<MediaStream | null>
): UseSpeechRecognitionReturn {
  const [liveTranscriptText, setLiveTranscriptText] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);

  const speechRecognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const recognitionStoppedRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const accumulatedTranscriptRef = useRef("");

  // WebSocket transcription refs
  const socketRef = useRef<WebSocket | null>(null);
  const liveStreamRecorderRef = useRef<MediaRecorder | null>(null);

  // ── Browser SpeechRecognition (Solution 1) ──────────────────────────────

  const startLiveTranscription = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.abort(); } catch {}
      speechRecognitionRef.current = null;
    }

    finalTranscriptRef.current = "";
    accumulatedTranscriptRef.current = "";
    setLiveTranscriptText("");
    setInterimTranscript("");
    recognitionStoppedRef.current = false;

    const launch = () => {
      if (recognitionStoppedRef.current) return;
      try {
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.lang = "en-IN";

        rec.onstart = () => { setIsListening(true); isListeningRef.current = true; };
        rec.onerror = (e: any) => {
          if (e.error === "no-speech" || e.error === "aborted") return;
          console.warn("Speech recognition error:", e.error);
        };
        rec.onend = () => {
          setIsListening(false);
          isListeningRef.current = false;
          speechRecognitionRef.current = null;
          setInterimTranscript("");
          if (!recognitionStoppedRef.current) launch();
        };
        rec.onresult = (event: any) => {
          let newFinal = "";
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const r = event.results[i];
            if (!r?.[0]) continue;
            if (r.isFinal) newFinal += r[0].transcript + " ";
            else interim += r[0].transcript;
          }
          if (newFinal) {
            finalTranscriptRef.current = (finalTranscriptRef.current + newFinal)
              .replace(/\s+/g, " ").trim();
            accumulatedTranscriptRef.current = finalTranscriptRef.current;
            setLiveTranscriptText(finalTranscriptRef.current);
          }
          setInterimTranscript(interim.trim());
        };

        recognitionStoppedRef.current = false;
        speechRecognitionRef.current = rec;
        rec.start();
      } catch (err) {
        console.warn("SpeechRecognition start failed:", err);
      }
    };

    launch();
  }, []);

  const stopLiveTranscription = useCallback(() => {
    recognitionStoppedRef.current = true;
    setIsListening(false);
    isListeningRef.current = false;
    setInterimTranscript("");
    try { speechRecognitionRef.current?.stop(); } catch {}
    speechRecognitionRef.current = null;
  }, []);

  // Lifecycle: start/stop based on phase + mic
  useEffect(() => {
    if (phase === "candidate_responding" && micEnabled) {
      startLiveTranscription();
    } else {
      stopLiveTranscription();
    }
  }, [phase, micEnabled, startLiveTranscription, stopLiveTranscription]);

  // ── FastAPI WebSocket transcription (Solution 2) ─────────────────────────

  useEffect(() => {
    const isTranscribePhase = phase === "candidate_responding" || phase === "aria_speaking";
    if (!isTranscribePhase || !streamRef.current || !micEnabled) {
      if (liveStreamRecorderRef.current?.state !== "inactive") {
        try { liveStreamRecorderRef.current?.stop(); } catch {}
      }
      try { socketRef.current?.close(); } catch {}
      socketRef.current = null;
      return;
    }

    let mounted = true;
    const wsUrl = buildTranscribeWsUrl(sessionId || "mock-session-001");
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      if (!streamRef.current || !mounted) return;
      try {
        const audioStream = new MediaStream(streamRef.current.getAudioTracks());
        const recorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
        liveStreamRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data?.size > 0 && ws.readyState === WebSocket.OPEN && mounted) {
            ws.send(e.data);
          }
        };
        recorder.start(1000);
      } catch (err) {
        console.warn("WebSocket MediaRecorder setup warning:", err);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript" && data.text?.trim() && mounted) {
          setLiveTranscriptText((prev) => {
            const cur = prev.trim();
            const next = data.text.trim();
            if (!cur) return next;
            if (cur.toLowerCase().includes(next.toLowerCase())) return cur;
            return `${cur} ${next}`;
          });
        }
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      mounted = false;
      try { liveStreamRecorderRef.current?.stop(); } catch {}
      try { socketRef.current?.close(); } catch {}
      socketRef.current = null;
    };
  }, [phase, micEnabled, sessionId, streamRef]);

  return {
    liveTranscriptText,
    setLiveTranscriptText,
    interimTranscript,
    isListening,
    startLiveTranscription,
    stopLiveTranscription,
  };
}
