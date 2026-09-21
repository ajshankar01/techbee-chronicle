"use client";

import { AlertTriangle, X } from "lucide-react";

interface ViolationBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ViolationBanner({ message, onDismiss }: ViolationBannerProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-3">
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 shadow-sm">
        <div className="flex items-center gap-2.5 text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-xs font-semibold">{message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-bold transition-colors"
          aria-label="Dismiss violation warning"
        >
          <X className="w-3.5 h-3.5" />
          Dismiss
        </button>
      </div>
    </div>
  );
}
