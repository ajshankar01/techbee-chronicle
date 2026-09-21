"use client";

interface StepIndicatorProps {
  currentIndex: number;
  total: number;
}

export function StepIndicator({ currentIndex, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        Question
      </span>
      <div className="flex items-center gap-1.5 flex-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i < currentIndex
                ? "bg-emerald-400"
                : i === currentIndex
                ? "bg-indigo-500"
                : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <span className="text-[11px] font-semibold text-slate-500">
        {currentIndex + 1} / {total}
      </span>
    </div>
  );
}
