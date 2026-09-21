'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export interface UseSpeechRecognitionOptions {
  enabled: boolean;
  language?: string;
  mediaStream?: MediaStream | null;
  onInterimResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition({
  enabled,
  language = 'en-US',
  mediaStream,
  onInterimResult,
  onFinalResult,
  onError,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isEnabledRef = useRef(enabled);
  const recognitionStoppedRef = useRef(false);

  // Audio Context for mic volume metering
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    isEnabledRef.current = enabled;
  }, [enabled]);

  const callbacksRef = useRef({ onInterimResult, onFinalResult, onError });
  useEffect(() => {
    callbacksRef.current = { onInterimResult, onFinalResult, onError };
  }, [onInterimResult, onFinalResult, onError]);

  // ── Stop Audio Metering ────────────────────────────────────────────────────
  const stopAudioMeter = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (localStreamRef.current && !mediaStream) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
  }, [mediaStream]);

  // ── Start Audio Metering ───────────────────────────────────────────────────
  const startAudioMeter = useCallback(async () => {
    try {
      let activeStream = mediaStream;
      if (!activeStream || !activeStream.active) {
        if (!localStreamRef.current || !localStreamRef.current.active) {
          localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        activeStream = localStreamRef.current;
      }

      if (activeStream && activeStream.getAudioTracks().length > 0) {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          audioCtxRef.current = audioCtx;

          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }

          const source = audioCtx.createMediaStreamSource(activeStream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.5;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!analyserRef.current || !isEnabledRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(100, Math.round((avg / 64) * 100));
            setAudioLevel(normalized);

            animFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        } else if (audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume();
        }
      }
    } catch (micErr) {
      console.warn('Microphone audio meter error:', micErr);
    }
  }, [mediaStream]);

  // ── Start Live Speech Recognition (Prevent Re-render Abort Loop) ──────────
  const startLiveTranscription = useCallback(() => {
    if (!SpeechRecognitionAPI) return;

    // If an instance already exists, do NOT stop or abort it!
    if (recognitionRef.current) {
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        console.log("SPEECH RECOGNITION STARTED");
        setIsListening(true);
        setErrorMsg(null);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        const errType = event.error || 'unknown';
        console.log("SPEECH RECOGNITION ERROR:", errType);

        if (errType === 'network') {
          setErrorMsg('Network speech blocked by browser policy');
        } else if (errType !== 'no-speech' && errType !== 'aborted') {
          setErrorMsg(errType);
          if (callbacksRef.current.onError) {
            callbacksRef.current.onError(errType);
          }
        }
      };

      recognition.onend = () => {
        console.log("SPEECH RECOGNITION ENDED");
        setIsListening(false);
        if (recognitionStoppedRef.current) {
          recognitionRef.current = null;
          return;
        }

        // Restart recognition safely on same instance after state reset
        if (isEnabledRef.current) {
          setTimeout(() => {
            if (isEnabledRef.current && !recognitionStoppedRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                setIsListening(true);
              } catch (err) {
                console.warn("Direct restart failed:", err);
              }
            }
          }, 200);
        } else {
          recognitionRef.current = null;
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          finalTranscript += event.results[i][0].transcript + " ";
        }

        const trimmed = finalTranscript.trim();
        setTranscript(trimmed);
        console.log("LIVE TRANSCRIPT:", trimmed);

        if (callbacksRef.current.onInterimResult) {
          callbacksRef.current.onInterimResult(trimmed);
        }
        if (callbacksRef.current.onFinalResult) {
          callbacksRef.current.onFinalResult(trimmed);
        }
      };

      recognitionStoppedRef.current = false;
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);

      startAudioMeter();
    } catch (e) {
      console.warn("SpeechRecognition start error:", e);
    }
  }, [language, startAudioMeter]);

  // ── Effect ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    if (enabled) {
      startLiveTranscription();
    } else {
      stopAudioMeter();
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionStoppedRef.current = true;
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
    }
  }, [enabled, startLiveTranscription, stopAudioMeter]);

  const start = useCallback(() => {
    setErrorMsg(null);
    isEnabledRef.current = true;
    recognitionStoppedRef.current = false;
    startLiveTranscription();
  }, [startLiveTranscription]);

  const stop = useCallback(() => {
    isEnabledRef.current = false;
    recognitionStoppedRef.current = true;
    stopAudioMeter();
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  }, [stopAudioMeter]);

  const reset = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    errorMsg,
    isSupported,
    audioLevel,
    start,
    stop,
    reset,
  };
}
