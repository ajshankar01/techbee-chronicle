"use client";

const GUIDELINES = [
  {
    icon: "⏱",
    title: "Timed Assessment",
    body: "This assessment is timed. Once started, the session timer cannot be paused or restarted.",
  },
  {
    icon: "🌐",
    title: "Stable Network Connection",
    body: "Ensure you are connected to a stable broadband or Wi-Fi network to prevent session interruption.",
  },
  {
    icon: "🎥",
    title: "Webcam & Seating Posture",
    body: "Position yourself at a comfortable eye-level with the camera. Ensure your face is fully visible throughout.",
  },
  {
    icon: "🔇",
    title: "Quiet & Well-Lit Environment",
    body: "Sit in a silent, well-lit room. Avoid background noise, music, or other voices. Ensure your face is clearly illuminated.",
  },
  {
    icon: "👁️",
    title: "Maintain Focus & Gaze",
    body: "Maintain eye contact with the screen. AI proctoring continuously logs gaze direction and off-screen movements.",
  },
  {
    icon: "⚠️",
    title: "Proctoring Violations",
    body: "Tab switching, split-screen use, or leaving the assessment window will trigger an integrity flag in your report.",
  },
  {
    icon: "🚫",
    title: "No Page Relocations or Reloads",
    body: "Do not refresh the page or use browser navigation buttons. Doing so will terminate the active interview session.",
  },
];

export function GuidelinesChecklist() {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
        📋 Assessment Guidelines
      </h3>
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {GUIDELINES.map((g, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-indigo-100 hover:bg-indigo-50/20 transition-colors"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-extrabold flex items-center justify-center mt-0.5">
              {i + 1}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs">{g.icon}</span>
                <h4 className="text-xs font-semibold text-slate-800">{g.title}</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{g.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
