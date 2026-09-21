"use client";

interface HardwareChecklistProps {
  mediaInitialized: boolean;
}

const STATIC_CHECKS = [
  { label: "AI Proctoring Shield", status: "Active" },
  { label: "Secure Network Integrity", status: "Verified" },
];

export function HardwareChecklist({ mediaInitialized }: HardwareChecklistProps) {
  const dynamicChecks = [
    { label: "Camera Access", status: mediaInitialized ? "Connected" : "Pending..." },
    { label: "Microphone Calibration", status: mediaInitialized ? "Active" : "Pending..." },
  ];

  const allChecks = [...dynamicChecks, ...STATIC_CHECKS];

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        Hardware Status
      </h4>
      {allChecks.map((c) => (
        <div key={c.label} className="flex items-center justify-between text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <span
              className={`font-extrabold text-sm ${
                c.status === "Pending..." ? "text-amber-400" : "text-emerald-600"
              }`}
            >
              {c.status === "Pending..." ? "⏳" : "✓"}
            </span>
            <span>{c.label}</span>
          </div>
          <span
            className={`font-medium text-[11px] ${
              c.status === "Pending..." ? "text-amber-500 animate-pulse" : "text-slate-500"
            }`}
          >
            {c.status}
          </span>
        </div>
      ))}
    </div>
  );
}
