"use client";

import { useEffect } from "react";

interface WebcamPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  streamRef?: React.MutableRefObject<MediaStream | null>;
  mediaInitialized: boolean;
}

export function WebcamPreview({ videoRef, streamRef, mediaInitialized }: WebcamPreviewProps) {
  // Ensure video element receives the stream as soon as component mounts
  useEffect(() => {
    if (videoRef.current && streamRef?.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [videoRef, streamRef, mediaInitialized]);

  return (
    <div className="rounded-xl border border-slate-200 bg-black overflow-hidden relative aspect-video flex items-center justify-center shadow-md">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover transform -scale-x-100"
      />

      {/* Loading overlay */}
      {!mediaInitialized && (
        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-3 text-center p-4">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Initializing secure video feed...</p>
        </div>
      )}

      {/* Live feed badge */}
      {mediaInitialized && (
        <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-emerald-50 rounded text-[10px] text-emerald-700 font-semibold tracking-wider uppercase border border-emerald-200 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live Feed Active
        </div>
      )}
    </div>
  );
}
