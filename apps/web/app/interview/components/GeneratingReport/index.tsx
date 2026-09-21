"use client";

type UploadStatus = "idle" | "video" | "analysis" | "pdf" | "done" | "error";

interface GeneratingReportProps {
  uploadStatus: UploadStatus;
  uploadErrorMsg: string | null;
  onProceedAnyway: () => void;
}

const STEPS = [
  {
    id: "video",
    label: "Upload secure session video recording",
    activeWhen: "video",
    doneWhen: ["analysis", "pdf", "done"],
  },
  {
    id: "analysis",
    label: "Run AI cognitive & psychometric evaluation",
    activeWhen: "analysis",
    doneWhen: ["pdf", "done"],
  },
  {
    id: "pdf",
    label: "Generate official PDF evaluation report",
    activeWhen: "pdf",
    doneWhen: ["done"],
  },
  {
    id: "vault",
    label: "Archive interview files securely to vault",
    activeWhen: "done",
    doneWhen: ["done"],
  },
] as const;

export function GeneratingReportScreen({
  uploadStatus,
  uploadErrorMsg,
  onProceedAnyway,
}: GeneratingReportProps) {
  return (
    <div
      className="flex-1 glass-card p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto my-auto border shadow-2xl bg-white"
      style={{ borderColor: "rgba(79, 70, 229, 0.12)" }}
    >
      {/* Spinner icon */}
      <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-6 relative">
        <span className="absolute inset-0 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        <span className="text-xl">🧠</span>
      </div>

      <h2
        className="text-2xl font-bold mb-2 text-slate-800"
        style={{ fontFamily: "Space Grotesk, sans-serif" }}
      >
        Saving Your Interview...
      </h2>
      <p className="text-sm text-slate-500 mb-8 max-w-md">
        Please do not close this window or navigate away. Aria is compiling your responses,
        behaviour data, and generating your vault evaluation report.
      </p>

      {/* Step checklist */}
      <div className="w-full bg-slate-50 rounded-xl p-5 border border-slate-100 text-left space-y-4 mb-6">
        {STEPS.map((step, idx) => {
          const isActive = uploadStatus === step.activeWhen;
          const isDone = (step.doneWhen as readonly string[]).includes(uploadStatus);

          return (
            <div key={step.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${
                    isDone
                      ? "bg-emerald-50 border-emerald-500 text-emerald-600 font-bold"
                      : isActive
                      ? "bg-indigo-50 border-indigo-500 text-indigo-600"
                      : "bg-slate-100 border-slate-200 text-slate-400"
                  }`}
                >
                  {isDone ? "✓" : String(idx + 1)}
                </div>
                <span
                  className={
                    isDone
                      ? "text-slate-400 line-through decoration-slate-300"
                      : isActive
                      ? "text-indigo-600 font-medium"
                      : "text-slate-500"
                  }
                >
                  {step.label}
                </span>
              </div>
              {isActive && (
                <span className="text-teal-400 text-xs flex items-center gap-1.5 font-medium animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                  In Progress...
                </span>
              )}
              {isDone && (
                <span className="text-emerald-400 text-xs font-semibold">Completed</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Error block */}
      {uploadStatus === "error" && (
        <div className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs text-left mb-6">
          <div className="font-bold mb-1 flex items-center gap-2">
            <span>⚠️ Upload Warning</span>
          </div>
          <div className="mt-1 leading-relaxed">
            We encountered an issue saving some artifacts:{" "}
            {uploadErrorMsg || "Connection interrupted."}
          </div>
          <button
            onClick={onProceedAnyway}
            className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs transition-colors"
          >
            Proceed to Exit Anyway
          </button>
        </div>
      )}
    </div>
  );
}
