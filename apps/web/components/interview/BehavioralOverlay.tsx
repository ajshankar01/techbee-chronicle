"use client";

import { useRef, useEffect } from "react";
import { BehavioralMetrics } from "@/lib/useMediaPipe";

interface BehavioralOverlayProps {
  metrics: BehavioralMetrics;
  videoWidth: number;
  videoHeight: number;
}

/**
 * Renders a transparent canvas overlay on the candidate video.
 * Shows a comprehensive behavioral intelligence dashboard visible to HR.
 * Candidate sees nothing — overlay is HR-only monitoring view.
 */
export default function BehavioralOverlay({
  metrics,
  videoWidth,
  videoHeight,
}: BehavioralOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoWidth || !videoHeight) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = videoWidth;
    canvas.height = videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;
    const H = canvas.height;

    // ── Helper functions ────────────────────────────────────────────────────

    const scoreColor = (score: number, inverted = false) => {
      const s = inverted ? 100 - score : score;
      if (s >= 75) return "#00d4aa";   // teal = good
      if (s >= 50) return "#f59e0b";   // amber = ok
      return "#ef4444";                 // red = bad
    };

    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const drawBar = (
      x: number, y: number, w: number, h: number,
      value: number, color: string, r = 2
    ) => {
      // Track
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      drawRoundRect(x, y, w, h, r);
      ctx.fill();
      // Fill
      if (value > 0) {
        ctx.fillStyle = color;
        drawRoundRect(x, y, Math.max(r * 2, (value / 100) * w), h, r);
        ctx.fill();
      }
    };

    const drawMiniMetric = (
      x: number, y: number, label: string, score: number,
      inverted = false, barW = 80
    ) => {
      const color = scoreColor(score, inverted);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, x, y);
      drawBar(x, y + 3, barW, 4, score, color);
      ctx.fillStyle = color;
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.fillText(`${score}%`, x + barW + 4, y + 4);
    };

    // ── 1. Face Not Detected Alert ─────────────────────────────────────────
    if (!metrics.faceVisible) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      drawRoundRect(6, 6, W - 12, H - 12, 12);
      ctx.stroke();
      ctx.fillStyle = "rgba(239,68,68,0.12)";
      drawRoundRect(6, 6, W - 12, H - 12, 12);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,0.75)";
      drawRoundRect(W / 2 - 110, H / 2 - 22, 220, 44, 8);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 15px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚠  Face Not Detected", W / 2, H / 2 + 5);
      return;
    }

    // ── 2. Multiple Faces Alert (bottom-left) ─────────────────────────────
    if (metrics.multipleFaces) {
      ctx.fillStyle = "rgba(239,68,68,0.92)";
      drawRoundRect(10, H - 46, 230, 34, 8);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("⚠ Multiple faces detected!", 18, H - 24);
    }

    // ── 3. Looking Away Banner (top-left) ────────────────────────────────
    if (metrics.lookingAway) {
      ctx.fillStyle = "rgba(245,158,11,0.90)";
      drawRoundRect(10, 10, 175, 28, 7);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("👀 Look at the camera", 18, 28);
    }

    // ── 4. Leaning / Posture Alert ────────────────────────────────────────
    if (metrics.isLeaning) {
      const alertY = metrics.lookingAway ? 46 : 10;
      ctx.fillStyle = "rgba(139,92,246,0.88)";
      drawRoundRect(10, alertY, 175, 28, 7);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("🪑 Sit straight — avoid leaning", 18, alertY + 18);
    }

    // ── 5. Main Metrics Panel (top-right) ─────────────────────────────────
    const panelW = 190;
    const panelH = 230;
    const panelX = W - panelW - 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0,0,0,0.72)";
    drawRoundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    drawRoundRect(panelX, panelY, panelW, panelH, 10);
    ctx.stroke();

    // Panel title
    ctx.fillStyle = "rgba(148,163,184,0.9)";
    ctx.font = "bold 9px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("🧠 BEHAVIORAL AI", panelX + 10, panelY + 14);

    let ry = panelY + 24;
    const rx = panelX + 10;
    const barW = 118;

    // Overall score (large)
    const overallColor = scoreColor(metrics.overallBehaviorScore);
    ctx.fillStyle = overallColor;
    ctx.font = "bold 22px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${metrics.overallBehaviorScore}`, rx, ry + 16);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "9px Inter, sans-serif";
    ctx.fillText("/ 100  Overall Score", rx + 30, ry + 10);

    drawBar(rx, ry + 20, barW + 34, 5, metrics.overallBehaviorScore, overallColor, 2);
    ry += 36;

    // Separator
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + barW + 34, ry); ctx.stroke();
    ry += 8;

    // Mindset metrics
    const mindsetMetrics = [
      { label: "👁 Eye Contact", value: metrics.eyeContactScore },
      { label: "💪 Confidence",  value: metrics.confidenceScore },
      { label: "⚡ Engagement",  value: metrics.engagementScore },
      { label: "😰 Nervousness", value: metrics.nervousnessScore, inv: true },
      { label: "🪑 Posture",     value: metrics.postureScore },
    ];

    for (const m of mindsetMetrics) {
      drawMiniMetric(rx, ry, m.label, m.value, m.inv ?? false, barW);
      ry += 16;
    }

    // ── 6. Emotion Panel (bottom-right) ───────────────────────────────────
    if (metrics.faceVisible) {
      const emoW = 190;
      const emoH = 118;
      const emoX = W - emoW - 10;
      const emoY = panelY + panelH + 8;

      ctx.fillStyle = "rgba(0,0,0,0.68)";
      drawRoundRect(emoX, emoY, emoW, emoH, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      drawRoundRect(emoX, emoY, emoW, emoH, 10);
      ctx.stroke();

      ctx.fillStyle = "rgba(148,163,184,0.9)";
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("😊 EMOTION ANALYSIS", emoX + 10, emoY + 14);

      const emotions = [
        { label: "😊 Smile",         value: metrics.smileScore,         color: "#4ade80" },
        { label: "😟 Frown",         value: metrics.frownScore,         color: "#f87171" },
        { label: "😲 Surprise",      value: metrics.surpriseScore,      color: "#facc15" },
        { label: "🤔 Concentration", value: metrics.concentrationScore, color: "#60a5fa" },
        { label: "😣 Stress",        value: metrics.stressScore,        color: "#f97316" },
        { label: "😒 Discomfort",    value: metrics.disgustScore,       color: "#a78bfa" },
      ];

      let ey = emoY + 24;
      const ex = emoX + 10;
      const eBarW = 100;

      for (const e of emotions) {
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.font = "9px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(e.label, ex, ey);
        drawBar(ex, ey + 3, eBarW, 3, e.value, e.color, 1);
        ctx.fillStyle = e.color;
        ctx.font = "bold 8px Inter, sans-serif";
        ctx.fillText(`${e.value}%`, ex + eBarW + 4, ey + 4);
        ey += 14;
      }
    }

    // ── 7. Posture Indicator (bottom-center) ──────────────────────────────
    if (metrics.shoulderLevelDiff > 0) {
      const posW = 160;
      const posX = (W - posW) / 2;
      const posY = H - 56;

      ctx.fillStyle = "rgba(0,0,0,0.65)";
      drawRoundRect(posX, posY, posW, 44, 8);
      ctx.fill();

      ctx.fillStyle = "rgba(148,163,184,0.8)";
      ctx.font = "8px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SHOULDER LEVEL", W / 2, posY + 13);

      drawBar(posX + 10, posY + 18, posW - 20, 5,
        metrics.shoulderLevelDiff, scoreColor(100 - metrics.shoulderLevelDiff), 2);

      const postureLabel = metrics.postureScore >= 75 ? "✅ Good Posture"
        : metrics.postureScore >= 50 ? "⚠ Slightly Slouching"
        : "❌ Poor Posture";

      ctx.fillStyle = scoreColor(metrics.postureScore);
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.fillText(postureLabel, W / 2, posY + 36);
    }

    // ── 8. Speaking Activity Pulse (bottom-left mic area) ─────────────────
    if (metrics.isSpeaking) {
      const r = 6;
      const cx = 24, cy = H - 20;
      ctx.fillStyle = "rgba(52,211,153,0.9)";
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(52,211,153,0.3)";
      ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Speaking", cx + 12, cy + 4);
    }

  }, [metrics, videoWidth, videoHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}
