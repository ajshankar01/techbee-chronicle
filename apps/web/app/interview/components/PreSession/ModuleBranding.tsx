"use client";

import { Clock } from "lucide-react";


interface ModuleBrandingProps {
  bondYear: number;
}

const MODULE_INFO: Record<number, { badge: string; title: string }> = {
  1: {
    badge: "Module 1 Assessment",
    title: "Module 1: Fitment & Baseline Goals",
  },
  2: {
    badge: "Module 2 Assessment",
    title: "Module 2: Longitudinal Progress",
  },
};

function getModuleInfo(bondYear: number) {
  return (
    MODULE_INFO[bondYear] || {
      badge: `Module ${bondYear} Assessment`,
      title: `Module ${bondYear}: Systems Design & Tech Leadership`,
    }
  );
}

export function ModuleBranding({ bondYear }: ModuleBrandingProps) {
  const { badge, title } = getModuleInfo(bondYear);

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col gap-4 p-6"
      style={{
        background: "linear-gradient(135deg, #4F46E5 0%, #0EA5E9 100%)",
      }}
    >
      {/* Honeycomb pattern overlay */}
      <div className="hc-bg absolute inset-0 opacity-10" />

      <div className="relative z-10 space-y-4">

        {/* Module title */}
        <h2 className="text-lg font-bold text-white leading-tight">{title}</h2>

      </div>

      {/* Duration only */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/15 border border-white/20">
          <Clock className="w-4 h-4 text-white/80" />
          <div>
            <p className="text-white text-xs font-bold">15 – 20 minutes</p>
            <p className="text-white/60 text-[10px]">Estimated session duration</p>
          </div>
        </div>
      </div>
    </div>
  );
}
