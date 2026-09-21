/**
 * useMediaStream.ts
 * Manages camera/microphone access, AudioContext routing, audio-level animation,
 * device enumeration, and hot-plug device switching.
 */
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface UseMediaStreamReturn {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  audioCtxRef: React.MutableRefObject<AudioContext | null>;
  audioDestRef: React.MutableRefObject<MediaStreamAudioDestinationNode | null>;
  mediaInitialized: boolean;
  audioLevel: number;
  audioDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string;
  switchAudioDevice: (deviceId: string) => Promise<void>;
}

export function useMediaStream(): UseMediaStreamReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [mediaInitialized, setMediaInitialized] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState("");

  const detectAndSelectAudioDevice = useCallback(async (): Promise<string> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      setAudioDevices(audioInputs);

      const headset = audioInputs.find((d) =>
        /headset|epos|usb|headphone/i.test(d.label)
      );
      const chosen = headset?.deviceId ?? audioInputs[0]?.deviceId ?? "";
      if (chosen) setSelectedAudioDeviceId(chosen);
      return chosen;
    } catch {
      return "";
    }
  }, []);

  const switchAudioDevice = useCallback(async (deviceId: string) => {
    setSelectedAudioDeviceId(deviceId);
    if (!streamRef.current) return;
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const newTrack = audioStream.getAudioTracks()[0];
      streamRef.current.getAudioTracks().forEach((t) => {
        streamRef.current?.removeTrack(t);
        t.stop();
      });
      streamRef.current.addTrack(newTrack);
    } catch (err) {
      console.warn("Failed to switch audio track:", err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const startMedia = async () => {
      if (streamRef.current?.active) return;

      const preferredDeviceId = await detectAndSelectAudioDevice();
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(preferredDeviceId ? { deviceId: { ideal: preferredDeviceId } } : {}),
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: audioConstraints,
        });
        if (!mounted) return;
        streamRef.current = stream;

        // Re-enumerate after permission granted to get labelled device names
        detectAndSelectAudioDevice();

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // AudioContext + composite destination (mic → recording + speakers)
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        if (audioCtx.state === "suspended") await audioCtx.resume();

        const audioDest = audioCtx.createMediaStreamDestination();
        audioDestRef.current = audioDest;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(audioDest);

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastAudioUpdate = 0;
        let lastReportedLevel = 0;
        const updateVolume = () => {
          if (!analyserRef.current || !mounted) return;
          const now = performance.now();
          if (now - lastAudioUpdate > 250) {
            lastAudioUpdate = now;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const newLevel = Math.min(100, Math.round((sum / dataArray.length / 25) * 100));
            if (Math.abs(newLevel - lastReportedLevel) >= 5) {
              lastReportedLevel = newLevel;
              setAudioLevel(newLevel);
            }
          }
          animFrameRef.current = requestAnimationFrame(updateVolume);
        };
        updateVolume();

        if (mounted) setMediaInitialized(true);
      } catch (err) {
        console.warn("MediaStream access warning:", err);
      }
    };

    startMedia();

    const handleDeviceChange = () => detectAndSelectAudioDevice();
    navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);

    return () => {
      mounted = false;
      setMediaInitialized(false);
      navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [detectAndSelectAudioDevice]);

  return {
    videoRef,
    streamRef,
    audioCtxRef,
    audioDestRef,
    mediaInitialized,
    audioLevel,
    audioDevices,
    selectedAudioDeviceId,
    switchAudioDevice,
  };
}
