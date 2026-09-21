"use client";

import { Volume2 } from "lucide-react";

interface Question {
  id: string;
  text: string;
  type: string;
}

interface AriaPanelProps {
  phase: string;
  activeQuestion: Question;
  onReplay: () => void;
}

export function AriaPanel({ phase, activeQuestion, onReplay }: AriaPanelProps) {
  const isSpeaking = phase === "aria_speaking";
  const isProcessing = phase === "processing";
  const displayQuestion = activeQuestion;

  const statusBadge = isSpeaking
    ? { label: "🔊 Aria Speaking", cls: "bg-purple-50 border-purple-200 text-purple-700" }
    : isProcessing
    ? { label: "🧠 Aria Analyzing...", cls: "bg-amber-50 border-amber-200 text-amber-700 animate-pulse" }
    : { label: "👂 Aria Listening", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" };

  return (
    <div
      className="lg:col-span-4 glass-card p-6 flex flex-col justify-between border shadow-sm bg-white/95"
      style={{ borderColor: "rgba(79, 70, 229, 0.1)" }}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            AI Interviewer
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>

        {/* Avatar */}
        <div className="relative w-36 h-36 mx-auto my-6 flex items-center justify-center">
          <div
            className={`absolute inset-0 rounded-full border-2 transition-all ${
              isSpeaking
                ? "border-purple-300 animate-ping opacity-75"
                : isProcessing
                ? "border-amber-300 animate-pulse scale-105"
                : "border-indigo-200"
            }`}
          />
          {isProcessing && (
            <div
              className="absolute inset-2 rounded-full border border-dashed border-amber-400/20 animate-spin"
              style={{ animationDuration: "6s" }}
            />
          )}
          <div
            className={`w-28 h-28 rounded-full border flex items-center justify-center text-4xl shadow-inner transition-all duration-300 ${
              isProcessing
                ? "bg-gradient-to-tr from-amber-50 to-purple-50 border-amber-200 scale-95"
                : "bg-gradient-to-tr from-indigo-50 to-purple-50 border-indigo-200"
            }`}
          >
            {isProcessing ? "🧠" : "🤖"}
          </div>
        </div>
      </div>

      {/* Question text */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Aria asks:
          </span>
          <button
            onClick={onReplay}
            className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 transition-colors font-bold"
            title="Replay question audio"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Replay Voice</span>
          </button>
        </div>
        <p className="text-sm font-semibold text-slate-800 leading-relaxed">
          {displayQuestion.text}
        </p>
      </div>
    </div>
  );
}
