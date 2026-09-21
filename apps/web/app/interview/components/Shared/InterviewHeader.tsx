"use client";

import Image from "next/image";
import { Clock, AlertCircle } from "lucide-react";

interface InterviewHeaderProps {
  elapsedSeconds: number;
  violationCount: number;
  formatTime: (s: number) => string;
}

export function InterviewHeader({
  elapsedSeconds,
  violationCount,
  formatTime,
}: InterviewHeaderProps) {
  return (
    <header className="relative flex items-center justify-center px-6 py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
      {/* Brand — centered */}
      <div className="flex items-center gap-3">
        <div className="relative w-8 h-8">
          <Image
            src="/techbee-logo.png"
            alt="TechBee Chronicle Logo"
            fill
            className="object-contain"
          />
        </div>
        <div>
          <span className="text-sm font-bold text-slate-800">Techbee Chronicle</span>
          <span className="text-[10px] text-slate-400 block leading-none">Interview Room</span>
        </div>
      </div>

      {/* Status badges — absolute right so brand stays centered */}
      <div className="absolute right-6 flex items-center gap-3">
        {/* Timer */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-600">
          <Clock className="w-3 h-3" />
          <span>{formatTime(elapsedSeconds)}</span>
        </div>

        {/* Violations */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
            violationCount > 0
              ? "bg-red-50 border-red-200 text-red-600"
              : "bg-slate-100 border-slate-200 text-slate-500"
          }`}
        >
          {violationCount > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          )}
          <AlertCircle className="w-3 h-3" />
          <span>Violations: {violationCount}</span>
        </div>
      </div>
    </header>
  );
}
