"use client";

import { CheckCircle } from "lucide-react";

export function CompletedScreen() {
  return (
    <div
      className="flex-1 glass-card p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto my-auto border shadow-2xl bg-white/95"
      style={{ borderColor: "rgba(79, 70, 229, 0.12)" }}
    >
      <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
        <CheckCircle className="w-10 h-10 text-emerald-600" />
      </div>

      <h2
        className="text-2xl font-bold mb-2 text-slate-800"
        style={{ fontFamily: "Space Grotesk, sans-serif" }}
      >
        Interview Successfully Completed! 🎉
      </h2>

      <p className="text-sm text-slate-600 mb-6 max-w-md">
        Thank you for completing your techbee chronical assessment. Your responses, voice transcripts,
        and proctoring metrics have been securely submitted.
      </p>

      <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-200 text-left mb-6 space-y-2">
        <div className="flex items-start gap-3">
          <div className="text-lg">📧</div>
          <div>
            <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
              Cadre Evaluation &amp; Next Steps
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Your detailed evaluation results are confidential and visible exclusively to the
              Cadre Management Team. You will receive your official report summary and
              next steps via email.
            </p>
          </div>
        </div>
      </div>

      <a
        href="/candidates"
        className="w-full py-3.5 px-6 rounded-xl font-extrabold text-white flex items-center justify-center gap-2 transition-all transform hover:scale-105 shadow-lg"
        style={{ background: "var(--gradient-brand)" }}
      >
        <span>Return to Dashboard →</span>
      </a>
    </div>
  );
}
