/**
 * useSimliAvatar — Simli.ai WebRTC avatar integration hook
 * Manages the Simli avatar session, WebRTC peer connection,
 * and streams TTS audio to produce lip-synced video of Aria
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type AvatarStatus = "idle" | "connecting" | "ready" | "speaking" | "error";

interface UseSimliAvatarOptions {
  avatarVideoRef: React.RefObject<HTMLVideoElement>;
  onStatusChange?: (status: AvatarStatus) => void;
}

export function useSimliAvatar({ avatarVideoRef, onStatusChange }: UseSimliAvatarOptions) {
  const [status, setStatus] = useState<AvatarStatus>("idle");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const updateStatus = useCallback((s: AvatarStatus) => {
    setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  /**
   * Initialize a Simli.ai avatar session.
   * Must be called after the user grants camera/mic access.
   */
  const initAvatar = useCallback(async (simliSessionData: {
    simli_session_token: string;
    ice_servers: RTCIceServer[];
    ws_url: string;
  }) => {
    try {
      updateStatus("connecting");
      const { simli_session_token, ice_servers, ws_url } = simliSessionData;
      setSessionToken(simli_session_token);

      // Create WebRTC peer connection
      const pc = new RTCPeerConnection({ iceServers: ice_servers });
      pcRef.current = pc;

      // Receive Aria's video stream from Simli
      pc.ontrack = (event) => {
        if (event.track.kind === "video" && avatarVideoRef.current) {
          avatarVideoRef.current.srcObject = event.streams[0];
          updateStatus("ready");
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "ice_candidate",
            candidate: event.candidate,
          }));
        }
      };

      // Connect to Simli WebSocket
      const ws = new WebSocket(ws_url);
      wsRef.current = ws;

      ws.onopen = async () => {
        // Create and send WebRTC offer
        const offer = await pc.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: true,
        });
        await pc.setLocalDescription(offer);

        ws.send(JSON.stringify({
          type: "offer",
          sdp: offer.sdp,
          session_token: simli_session_token,
        }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "answer") {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: data.sdp })
          );
        } else if (data.type === "ice_candidate") {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      };

      ws.onerror = () => updateStatus("error");
      ws.onclose = () => {
        if (status !== "error") updateStatus("idle");
      };

    } catch (err) {
      console.error("Simli avatar init failed:", err);
      updateStatus("error");
    }
  }, [avatarVideoRef, updateStatus, status]);

  /**
   * Send TTS audio (base64 MP3) to Simli for lip-sync rendering.
   * Called before each of Aria's questions.
   */
  const speakAudio = useCallback((audioBase64: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("Simli WS not open — cannot send audio");
      return;
    }
    updateStatus("speaking");
    wsRef.current.send(JSON.stringify({
      type: "audio",
      audio_data: audioBase64,
      audio_format: "mp3",
    }));
  }, [updateStatus]);

  /**
   * Called by Simli when audio playback finishes.
   * Transitions avatar back to listening state.
   */
  const onSpeakingComplete = useCallback(() => {
    updateStatus("ready");
  }, [updateStatus]);

  // Cleanup
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      pcRef.current?.close();
    };
  }, []);

  return { status, sessionToken, initAvatar, speakAudio, onSpeakingComplete };
}

// ── Fallback Avatar Component (when Simli.ai is not connected) ────────────────
// Used during development or when WebRTC fails to establish

export function FallbackAriaAvatar({
  isSpeaking,
  isProcessing,
}: {
  isSpeaking: boolean;
  isProcessing: boolean;
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4"
      style={{ background: "linear-gradient(135deg, #111827 0%, #0a0f1e 100%)" }}>

      {/* Avatar circle */}
      <div className={`relative ${isSpeaking ? "avatar-ring speaking" : "avatar-ring"}`}>
        <div className="w-40 h-40 rounded-full flex items-center justify-center overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #1e3a5f 0%, #0d1f35 100%)",
            border: "3px solid rgba(0,212,170,0.2)"
          }}>
          {/* Stylized AI face */}
          <svg viewBox="0 0 120 120" className="w-32 h-32">
            {/* Face base */}
            <ellipse cx="60" cy="65" rx="36" ry="40" fill="#1a3a5c" />
            {/* Eyes */}
            <ellipse cx="48" cy="55" rx="5" ry={isSpeaking ? "4" : "5"}
              fill="#00d4aa" opacity="0.9" />
            <ellipse cx="72" cy="55" rx="5" ry={isSpeaking ? "4" : "5"}
              fill="#00d4aa" opacity="0.9" />
            {/* Eye glow */}
            <ellipse cx="48" cy="55" rx="7" ry="7" fill="#00d4aa" opacity="0.15" />
            <ellipse cx="72" cy="55" rx="7" ry="7" fill="#00d4aa" opacity="0.15" />
            {/* Mouth */}
            <path
              d={isSpeaking
                ? "M 48 75 Q 60 82 72 75"
                : "M 50 74 Q 60 78 70 74"}
              stroke="#00d4aa" strokeWidth="2.5" fill="none"
              strokeLinecap="round"
              opacity={isSpeaking ? 1 : 0.5}
            />
            {/* Hair/top */}
            <ellipse cx="60" cy="30" rx="30" ry="20" fill="#0d2040" />
            {/* Suit collar */}
            <path d="M 35 100 L 45 85 L 60 90 L 75 85 L 85 100 Z" fill="#0d1f35" />
            <path d="M 52 88 L 60 95 L 68 88" stroke="#1a3a5c" strokeWidth="1.5" fill="none" />
            {/* AR circuit overlay */}
            <circle cx="60" cy="60" r="48" stroke="#00d4aa" strokeWidth="0.5" fill="none" opacity="0.2" />
          </svg>
        </div>
      </div>

      {/* Status text */}
      <div className="text-center">
        <div className="flex items-center gap-2 justify-center mb-1">
          <span className="font-semibold text-sm" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            Aria
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            AI Interviewer
          </span>
        </div>

        {isSpeaking ? (
          <div className="flex items-center gap-0.5 justify-center">
            {[2,5,8,6,9,4,7,3,5,8,4,6].map((h, i) => (
              <div key={i} className="w-0.5 rounded-full bg-teal-400"
                style={{
                  height: `${h * 2}px`,
                  animation: "wave-bar 0.5s ease-in-out infinite",
                  animationDelay: `${i * 0.05}s`,
                  opacity: 0.8,
                }} />
            ))}
          </div>
        ) : isProcessing ? (
          <div className="flex gap-1 justify-center">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Listening...</p>
        )}
      </div>
    </div>
  );
}
