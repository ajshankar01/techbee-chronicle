"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface ConsentFooterProps {
  mediaInitialized: boolean;
  onBegin: () => void;
}

export function ConsentFooter({ mediaInitialized, onBegin }: ConsentFooterProps) {
  const [accepted, setAccepted] = useState(true);
  const canBegin = accepted && mediaInitialized;

  return (
    <div className="space-y-4">
      {/* Consent checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="sr-only"
          />
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
              accepted
                ? "bg-indigo-600 border-indigo-600"
                : "border-slate-300 bg-white group-hover:border-indigo-400"
            }`}
          >
            {accepted && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          I agree to the assessment guidelines, consent to secure webcam and audio evaluation, and confirm I am ready to begin my session.
        </p>
      </label>

      {/* Begin button */}
      <button
        onClick={onBegin}
        disabled={!canBegin}
        className={`w-full py-4 rounded-xl font-extrabold text-white flex items-center justify-center gap-2.5 shadow-lg text-sm tracking-wide transition-all transform ${
          canBegin
            ? "hover:scale-[1.02] active:scale-[0.99]"
            : "opacity-50 cursor-not-allowed"
        }`}
        style={{ background: canBegin ? "var(--gradient-brand)" : undefined, backgroundColor: !canBegin ? "#94a3b8" : undefined }}
        id="begin-assessment-btn"
      >
        {!mediaInitialized ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>CONNECTING HARDWARE...</span>
          </>
        ) : !accepted ? (
          <span>AGREE TO GUIDELINES FIRST</span>
        ) : (
          <>
            <span>BEGIN ASSESSMENT SESSION</span>
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Footer links */}
      <p className="text-center text-[10px] text-slate-400">
        Powered by TechBee Chronicle &nbsp;·&nbsp; Platform Help &nbsp;·&nbsp; FAQ
      </p>
    </div>
  );
}
