"use client";

import { ModuleBranding } from "./ModuleBranding";
import { GuidelinesChecklist } from "./GuidelinesChecklist";
import { WebcamPreview } from "./WebcamPreview";
import { HardwareChecklist } from "./HardwareChecklist";
import { ConsentFooter } from "./ConsentFooter";

interface PreSessionProps {
  bondYear: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamRef?: React.MutableRefObject<MediaStream | null>;
  mediaInitialized: boolean;
  onBegin: () => void;
}

/**
 * PreSession — unified single-screen pre-interview setup.
 *
 * Replaces the previous two-step flow (instructions → ready).
 * Left panel: module branding + live webcam + hardware status.
 * Right panel: guidelines + consent declaration + begin CTA.
 */
export function PreSession({ bondYear, videoRef, streamRef, mediaInitialized, onBegin }: PreSessionProps) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── LEFT COLUMN (5/12): Branding + Webcam + Hardware ── */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <ModuleBranding bondYear={bondYear} />
          <WebcamPreview videoRef={videoRef} streamRef={streamRef} mediaInitialized={mediaInitialized} />
          <HardwareChecklist mediaInitialized={mediaInitialized} />
        </div>

        {/* ── RIGHT COLUMN (7/12): Guidelines + Consent + CTA ── */}
        <div className="lg:col-span-7 flex flex-col gap-5">

          <GuidelinesChecklist />

          {/* Secure Data card */}
          <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1.5">
              <span>🔒</span>
              <span>Secure Data &amp; Consent Declaration</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Your video responses, audio transcripts, and behavioural metrics are processed using
              secure encryption and archived in the secure vault. This information is managed
              strictly for your <strong>career growth, skill alignment, and training development</strong>.
              Only authorised HCL HR panels have access, ensuring complete privacy and compliance.
            </p>
          </div>

          <ConsentFooter mediaInitialized={mediaInitialized} onBegin={onBegin} />
        </div>

      </div>
    </div>
  );
}
