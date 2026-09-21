"use client";

import { Mic, MicOff, Video as VideoIcon, VideoOff, ChevronRight } from "lucide-react";
import BehavioralOverlay from "@/components/interview/BehavioralOverlay";

interface CandidatePanelProps {
  phase: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  metrics: any;
  isListening: boolean;
  audioLevel: number;
  micEnabled: boolean;
  camEnabled: boolean;
  audioDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onSwitchDevice: (id: string) => void;
  onStopResponding: () => void;
}

export function CandidatePanel({
  phase,
  videoRef,
  metrics,
  isListening,
  audioLevel,
  micEnabled,
  camEnabled,
  audioDevices,
  selectedAudioDeviceId,
  onToggleMic,
  onToggleCam,
  onSwitchDevice,
  onStopResponding,
}: CandidatePanelProps) {
  const isResponding = phase === "candidate_responding";
  const isSpeaking = phase === "aria_speaking";

  return (
    <div
      className="lg:col-span-5 glass-card p-4 flex flex-col justify-between relative overflow-hidden border shadow-sm bg-white/95"
      style={{ borderColor: "rgba(79, 70, 229, 0.1)" }}
    >
      {/* Video feed */}
      <div className="relative flex-1 rounded-xl overflow-hidden bg-black flex items-center justify-center min-h-[340px]">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover transform -scale-x-100"
        />

        {/* MediaPipe proctoring overlay */}
        <BehavioralOverlay metrics={metrics} videoWidth={1280} videoHeight={720} />

        {/* Audio level bar */}
        <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                isListening ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              }`}
            />
            <span>{isListening ? "Live Mic Active" : "Mic Ready"}</span>
          </div>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-75"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-mono w-8 text-right">
            {audioLevel}%
          </span>
        </div>
      </div>

      {/* Controls row */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Mic toggle */}
          <button
            onClick={onToggleMic}
            aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
            className={`p-2.5 rounded-lg border transition-colors ${
              micEnabled
                ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/80"
                : "bg-red-50 border-red-200 text-red-600"
            }`}
          >
            {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Camera toggle */}
          <button
            onClick={onToggleCam}
            aria-label={camEnabled ? "Disable camera" : "Enable camera"}
            className={`p-2.5 rounded-lg border transition-colors ${
              camEnabled
                ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/80"
                : "bg-red-50 border-red-200 text-red-600"
            }`}
          >
            {camEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          {/* Device selector */}
          {audioDevices.length > 0 && (
            <select
              value={selectedAudioDeviceId}
              onChange={(e) => onSwitchDevice(e.target.value)}
              className="bg-slate-100 text-[11px] text-slate-700 border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:border-indigo-500 max-w-[170px] truncate"
              aria-label="Select microphone device"
            >
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Mic (${d.deviceId.slice(0, 6)}...)`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Done speaking / next button */}
        {(isResponding || isSpeaking) && (
          <button
            onClick={onStopResponding}
            className="px-6 py-2.5 rounded-lg font-extrabold text-white flex items-center gap-2 transition-all transform hover:scale-105 shadow-md"
            style={{ background: "var(--gradient-brand)" }}
            id="done-speaking-btn"
          >
            <span>{isSpeaking ? "Start Answering / Next →" : "Done Speaking →"}</span>
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
