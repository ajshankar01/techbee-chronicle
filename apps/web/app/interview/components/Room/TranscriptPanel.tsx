"use client";

import { useState } from "react";

interface TranscriptPanelProps {
  liveTranscriptText: string;
  interimTranscript: string;
  isListening: boolean;
  onTranscriptChange: (text: string) => void;
}

/**
 * TranscriptPanel — live speech transcript display.
 * Replaces the old window.prompt() with an inline editable textarea.
 */
export function TranscriptPanel({
  liveTranscriptText,
  interimTranscript,
  isListening,
  onTranscriptChange,
}: TranscriptPanelProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const startEdit = () => {
    setEditValue(liveTranscriptText);
    setEditing(true);
  };

  const confirmEdit = () => {
    onTranscriptChange(editValue);
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  return (
    <div
      className="lg:col-span-3 glass-card p-4 flex flex-col justify-between border shadow-sm bg-white/95"
      style={{ borderColor: "rgba(79, 70, 229, 0.1)" }}
    >
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Live Speech Transcript
          </span>
          <div className="flex items-center gap-2">
            {isListening && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Listening
              </span>
            )}
            {interimTranscript && (
              <span className="text-[10px] text-amber-600 font-medium animate-pulse">
                transcribing...
              </span>
            )}
          </div>
        </div>

        {/* Transcript or edit mode */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full bg-slate-50 p-3 rounded-xl border border-indigo-300 text-xs text-slate-800 leading-relaxed font-sans resize-none min-h-[200px] max-h-[300px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
              aria-label="Edit transcript"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmEdit}
                className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 py-2 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="w-full bg-slate-50 p-3.5 rounded-xl border border-slate-200 min-h-[220px] max-h-[340px] overflow-y-auto text-xs leading-relaxed font-sans"
              style={{
                borderColor: isListening ? "rgba(79,70,229,0.3)" : undefined,
                transition: "border-color 0.2s",
              }}
            >
              <span className="text-slate-800 font-semibold">
                {liveTranscriptText}
                {liveTranscriptText && interimTranscript ? " " : ""}
              </span>
              {interimTranscript && (
                <span className="text-amber-600 italic font-semibold">{interimTranscript}</span>
              )}
              {!liveTranscriptText && !interimTranscript && (
                <span className="text-slate-400 italic">
                  Speak into your microphone — your words will appear here instantly as you speak...
                </span>
              )}
            </div>

            <div className="mt-2 text-[10px] text-slate-500">
              Need to correct something?{" "}
              <button
                onClick={startEdit}
                className="text-teal-600 underline underline-offset-2 hover:text-teal-700 font-bold"
              >
                Edit manually
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tip */}
      <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
        💡 <span className="font-semibold text-slate-700">Tip:</span> Speak clearly at a steady pace.{" "}
        <span className="text-amber-600 font-semibold italic">Amber text</span> = being transcribed,{" "}
        <span className="text-slate-800 font-bold">dark text</span> = confirmed. Click{" "}
        <strong className="text-slate-800 font-extrabold">Done Speaking</strong> when finished.
      </div>
    </div>
  );
}
