"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Card3D from "@/components/Card3D";
import {
  ShieldCheck, Video, Mic, ArrowRight, Lock, FileText, CheckCircle2
} from "lucide-react";

// HexBackground3D is rendered globally in layout.tsx

interface CandidateProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "ready" | "in_progress" | "completed";
  scheduledTime: string;
  estimatedDuration: string;
  systemCheck: { webcam: boolean; mic: boolean; network: string };
  assessmentRounds: { round: number; name: string; type: string; questions: number; duration: string }[];
  doj?: string;
  bondYear?: number;
}

const LOGGED_IN_CANDIDATE: CandidateProfile = {
  id: "c1",
  name: "Ajay Shankar",
  email: "ajay.shankar@techbee.in",
  role: "TechBee Trainee — Full-Stack",
  status: "ready",
  scheduledTime: "Today at 5:30 PM IST",
  estimatedDuration: "15 - 20 minutes",
  systemCheck: { webcam: true, mic: true, network: "Excellent (45ms)" },
  assessmentRounds: [
    { round: 1, name: "Module 1: Fitment & Baseline Goals", type: "Tell me about yourself & basic fitment", questions: 1, duration: "5 mins" },
    { round: 2, name: "Psychometric Mindset & Adaptability", type: "Behavioral & Scenario", questions: 1, duration: "5 mins" },
    { round: 3, name: "Communication & Stakeholder Fitting", type: "Verbal Alignment", questions: 1, duration: "5 mins" },
    { round: 4, name: "Cognitive Ability", type: "Logical reasoning & problem solving", questions: 1, duration: "5 mins" },
  ],
  doj: "01 Jan 2026",
  bondYear: 1,
};

const safeFormatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr || dateStr === "undefined" || dateStr === "null") return "01 Jan 2026";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "01 Jan 2026";
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return "01 Jan 2026";
  }
};

const formatDisplayName = (name: string): string => {
  if (!name) return "Candidate";
  return name
    .split(/[\._]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export default function SingleCandidatePortalPage() {
  const [profile, setProfile] = useState<CandidateProfile>(LOGGED_IN_CANDIDATE);

  useEffect(() => {
    // Read candidate name from sessionStorage (supports both Teams SSO and direct URL params)
    const displayName = sessionStorage.getItem("candidate_display_name") || sessionStorage.getItem("candidate_name");
    const storedEmail = sessionStorage.getItem("candidate_email");
    const storedSap = sessionStorage.getItem("candidate_sap_id");
    
    if (displayName) {
      setProfile(prev => ({
        ...prev,
        name: displayName,
        email: storedEmail || prev.email,
        id: storedSap || prev.id,
      }));
    }

    const fetchCandidateProfile = async () => {
      try {
        const LOCAL_API = "http://localhost:8000";
        const token = sessionStorage.getItem("teams_token") || "dev-token";
        
        const savedName = sessionStorage.getItem("candidate_name") || "";
        const savedDoj = sessionStorage.getItem("candidate_doj") || "";
        const savedBondYear = sessionStorage.getItem("candidate_bond_year") || "";

        let url = `${LOCAL_API}/api/auth/me`;
        const params = new URLSearchParams();
        if (savedName) params.append("name", savedName);
        if (savedDoj) params.append("join_date", savedDoj);
        if (savedBondYear) params.append("bond_year", savedBondYear);

        const queryString = params.toString();
        if (queryString) {
          url += `?${queryString}`;
        }

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Use the bond year computed at login from sessionStorage as source of truth.
          // Only fall back to API value if sessionStorage has nothing.
          const bondYear = savedBondYear
            ? parseInt(savedBondYear, 10)
            : (data.current_bond_year || 1);
          const sapId = data.sap_id || storedSap || "SAP100492";
          
          // Generate assessment rounds based on bond year:
          let rounds = [];
          if (bondYear === 1) {
            rounds = [
              { round: 1, name: "Module 1: Fitment & Baseline Goals", type: "Tell me about yourself & basic fitment", questions: 1, duration: "5 mins" },
              { round: 2, name: "Psychometric Mindset & Adaptability", type: "Behavioral & Scenario", questions: 1, duration: "5 mins" },
              { round: 3, name: "Communication & Stakeholder Fitting", type: "Verbal Alignment", questions: 1, duration: "5 mins" },
              { round: 4, name: "Cognitive Ability", type: "Logical reasoning & problem solving", questions: 1, duration: "5 mins" },
            ];
          } else if (bondYear === 2) {
            rounds = [
              { round: 1, name: "Module 2: Longitudinal Progress", type: "Review of previous year responses & goals", questions: 1, duration: "5 mins" },
              { round: 2, name: "Technical Architecture & Systems", type: "Advanced Engineering & Scaling", questions: 1, duration: "5 mins" },
              { round: 3, name: "Incident Response & Crisis Management", type: "Incident Forensics", questions: 1, duration: "5 mins" },
              { round: 4, name: "Cognitive Ability", type: "Logical reasoning & problem solving", questions: 1, duration: "5 mins" },
            ];
          } else {
            rounds = [
              { round: 1, name: "Module 3: Systems Design & Tech Leadership", type: "High toughness system architecture", questions: 1, duration: "5 mins" },
              { round: 2, name: "Production Incident Forensics", type: "Debugging under high stakes", questions: 1, duration: "5 mins" },
              { round: 3, name: "Strategic Adaptability & Alignment", type: "Leadership & organizational scaling", questions: 1, duration: "5 mins" },
              { round: 4, name: "Cognitive Ability", type: "Logical reasoning & problem solving", questions: 1, duration: "5 mins" },
            ];
          }
          
          const formattedDoj = savedDoj ? safeFormatDate(savedDoj) : safeFormatDate(data.join_date);
          const finalName = sessionStorage.getItem("candidate_name") || data.name || data.display_name || "Candidate";
          if (data.name || finalName) {
            sessionStorage.setItem("candidate_name", finalName);
            sessionStorage.setItem("candidate_display_name", finalName);
          }
          if (data.email) {
            sessionStorage.setItem("candidate_email", data.email);
          }
          if (sapId) {
            sessionStorage.setItem("candidate_sap_id", sapId);
          }
          if (bondYear) {
            sessionStorage.setItem("candidate_bond_year", String(bondYear));
          }

          setProfile(prev => ({
            ...prev,
            name: finalName,
            email: data.email || prev.email,
            id: sapId,
            assessmentRounds: rounds,
            doj: formattedDoj,
            bondYear: bondYear,
          }));
        }
      } catch (err) {
        console.warn("Could not fetch candidate profile details from API:", err);
        // Even if API fails, apply bond year from sessionStorage so module is correct
        const savedBondYearFallback = sessionStorage.getItem("candidate_bond_year");
        const bondYearFallback = savedBondYearFallback ? parseInt(savedBondYearFallback, 10) : 1;
        const savedDojFallback = sessionStorage.getItem("candidate_doj") || "";
        let roundsFallback = [];
        if (bondYearFallback === 1) {
          roundsFallback = [
            { round: 1, name: "Module 1: Fitment & Baseline Goals", type: "Tell me about yourself & basic fitment", questions: 1, duration: "5 mins" },
            { round: 2, name: "Psychometric Mindset & Adaptability", type: "Behavioral & Scenario", questions: 1, duration: "5 mins" },
            { round: 3, name: "Communication & Stakeholder Fitting", type: "Verbal Alignment", questions: 1, duration: "5 mins" },
            { round: 4, name: "Cognitive Ability", type: "Logical reasoning & problem solving", questions: 1, duration: "5 mins" },
          ];
        } else if (bondYearFallback === 2) {
          roundsFallback = [
            { round: 1, name: "Module 2: Longitudinal Progress", type: "Review of previous year responses & goals", questions: 1, duration: "5 mins" },
            { round: 2, name: "Technical Architecture & Systems", type: "Advanced Engineering & Scaling", questions: 1, duration: "5 mins" },
            { round: 3, name: "Incident Response & Crisis Management", type: "Incident Forensics", questions: 1, duration: "5 mins" },
            { round: 4, name: "Cognitive Ability", type: "Logical reasoning & problem solving", questions: 1, duration: "5 mins" },
          ];
        } else {
          roundsFallback = [
            { round: 1, name: "Module 3: Systems Design & Tech Leadership", type: "High toughness system architecture", questions: 1, duration: "5 mins" },
            { round: 2, name: "Production Incident Forensics", type: "Debugging under high stakes", questions: 1, duration: "5 mins" },
            { round: 3, name: "Strategic Adaptability & Alignment", type: "Leadership & organizational scaling", questions: 1, duration: "5 mins" },
            { round: 4, name: "Cognitive Ability", type: "Logical reasoning & problem solving", questions: 1, duration: "5 mins" },
          ];
        }
        setProfile(prev => ({
          ...prev,
          assessmentRounds: roundsFallback,
          doj: savedDojFallback ? safeFormatDate(savedDojFallback) : prev.doj,
          bondYear: bondYearFallback,
        }));
      }
    };
    
    fetchCandidateProfile();
  }, []);

  return (
    <div className="min-h-screen text-slate-800 flex flex-col relative overflow-hidden" style={{ background: "transparent" }}>
      {/* HexBackground3D background is global */}

      {/* Header Bar */}
      <header
        className="px-8 py-4 border-b grid grid-cols-3 items-center relative z-10"
        style={{ background: "rgba(255,255,255,0.85)", borderColor: "rgba(79, 70, 229, 0.12)", backdropFilter: "blur(12px)" }}
      >
        {/* Left Column Spacer (balances the right column) */}
        <div className="flex justify-start" />

        {/* Centered Column: Logo and Title */}
        <div className="flex items-center justify-center gap-4">
          <Image
            src="/techbee-logo.png"
            alt="TechBee Logo"
            width={48}
            height={48}
            className="object-contain"
            priority
          />
          <div className="text-left">
            <h1 className="font-extrabold text-2xl leading-none text-slate-800" style={{ fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.02em" }}>
              Techbee Chronicle
            </h1>
            <p className="text-sm text-slate-500 font-medium leading-none mt-1">Personalized Assessment Hub</p>
          </div>
        </div>

        {/* Right Column: Secure Indicator */}
        <div className="flex justify-end">
          <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2 text-xs text-slate-700 shadow-sm">
            <Lock className="w-3.5 h-3.5 text-indigo-500" />
            <span>Isolated Secure Session</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-12 space-y-10 relative z-10">
        {/* Isolated Candidate Welcome Header Card */}
        <div
          className="p-10 md:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 border relative overflow-hidden shadow-2xl rounded-3xl"
            style={{ background: "var(--gradient-brand)", border: "none" }}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-24 h-24 rounded-3xl bg-white/20 border border-white/30 flex items-center justify-center text-white font-extrabold text-4xl shadow-lg shrink-0">
                {formatDisplayName(profile.name).charAt(0)}
              </div>
              <div className="text-left">
                <div className="flex flex-wrap items-center gap-3.5 mb-2">
                  <h2 className="font-extrabold text-3xl md:text-4xl text-white tracking-tight" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                    Welcome, {formatDisplayName(profile.name)}
                  </h2>
                  <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-white/20 border border-white/30 text-white tracking-wide uppercase">
                    🟢 Assessment Ready
                  </span>
                </div>
                <p className="text-base md:text-lg text-white/95 font-semibold">SAP ID: {profile.id || "SAP100492"}</p>
                {profile.doj && (
                  <p className="text-sm text-white/90 mt-1 font-semibold">
                    Date of Joining: {profile.doj} • Module {profile.bondYear || 1}
                  </p>
                )}
                <p className="text-sm text-white/80 mt-1.5">{profile.email} • Scheduled for: {profile.scheduledTime}</p>
              </div>
            </div>

            <a
              href="/interview"
              onClick={() => {
                try {
                  sessionStorage.setItem("current_candidate_id", profile.id || "SAP100492");
                } catch (e) {
                  console.warn("Could not save current_candidate_id in sessionStorage:", e);
                }
              }}
              className="w-full lg:w-auto px-10 py-5 text-base font-black text-indigo-600 bg-white hover:bg-slate-50 hover:shadow-2xl rounded-2xl transition-all transform hover:scale-105 flex items-center justify-center gap-3.5 shadow-xl shrink-0"
              style={{ cursor: "pointer", textDecoration: "none" }}
            >
              <span>Start My Interview Session</span>
              <ArrowRight className="w-5 h-5 stroke-[3]" />
            </a>
        </div>

        {/* Secure Evaluation Consent & Data Privacy Banner */}
        <div className="p-6 rounded-2xl bg-indigo-50/40 border border-indigo-100 flex flex-col md:flex-row items-start gap-4 text-left shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-white border border-indigo-150 flex items-center justify-center shadow-sm shrink-0">
            <Lock className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800 mb-1">
              Secure Evaluation & Candidate Data Privacy Consent
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your video responses, audio transcripts, and proctoring telemetry are processed locally using secure encryption and archived in the candidate vault. This information is managed strictly for your <strong>career growth, skill alignment, and training development</strong>. Only authorized HCL HR panels have access, ensuring complete privacy, compliance, and zero data leak possibility.
            </p>
          </div>
        </div>

        {/* 2-Column Grid: Hardware Readiness + Assessment Structure */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Hardware & System Verification (5 cols) */}
          <div className="lg:col-span-5 h-full">
            <Card3D intensity={8} shimmer={true} glowColor="rgba(79,70,229,0.06)" style={{ height: '100%' }}>
              <div className="glass-card p-8 flex flex-col justify-between border h-full" style={{ borderColor: "rgba(79, 70, 229, 0.12)", background: "#ffffff" }}>
                <div>
                  <h3 className="font-bold text-xl md:text-2xl mb-6 flex items-center gap-3 text-slate-800" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                    <ShieldCheck className="w-6 h-6 text-indigo-500" />
                    <span>System Readiness Check</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="p-4.5 md:p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Video className="w-5 h-5 text-indigo-500" />
                        <div className="text-left">
                          <p className="text-sm md:text-base font-bold text-slate-700">Webcam Stream</p>
                          <p className="text-xs md:text-sm text-slate-500">Face Landmarker Ready</p>
                        </div>
                      </div>
                      <span className="text-sm text-emerald-600 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Active
                      </span>
                    </div>

                    <div className="p-4.5 md:p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Mic className="w-5 h-5 text-indigo-500" />
                        <div className="text-left">
                          <p className="text-sm md:text-base font-bold text-slate-700">Microphone Audio</p>
                          <p className="text-xs md:text-sm text-slate-500">WebSocket Live Transcriber</p>
                        </div>
                      </div>
                      <span className="text-sm text-emerald-600 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Connected
                      </span>
                    </div>

                    <div className="p-4.5 md:p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <ShieldCheck className="w-5 h-5 text-purple-600" />
                        <div className="text-left">
                          <p className="text-sm md:text-base font-bold text-slate-700">MediaPipe Proctoring</p>
                          <p className="text-xs md:text-sm text-slate-500">Eye-Tracking & Anti-Cheat</p>
                        </div>
                      </div>
                      <span className="text-sm text-purple-600 font-bold">Enabled</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 text-sm text-indigo-700 text-left">
                  💡 <strong>Candidate Tip:</strong> Ensure you are in a quiet room with good lighting. The interview takes approximately 15 minutes.
                </div>
              </div>
            </Card3D>
          </div>

          {/* Assessment Breakdown (7 cols) */}
          <div className="lg:col-span-7 h-full">
            <Card3D intensity={8} shimmer={true} glowColor="rgba(79,70,229,0.06)" style={{ height: '100%' }}>
              <div className="glass-card p-8 flex flex-col justify-between border h-full" style={{ borderColor: "rgba(79, 70, 229, 0.12)", background: "#ffffff" }}>
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-xl md:text-2xl flex items-center gap-3 text-slate-800" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                      <FileText className="w-6 h-6 text-purple-600" />
                      <span>Interview Assessment Rounds</span>
                    </h3>
                    <span className="text-sm text-slate-500 font-mono">Est. {profile.estimatedDuration}</span>
                  </div>

                  <div className="space-y-4">
                    {profile.assessmentRounds.map((rnd) => (
                      <div key={rnd.round} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold text-sm flex items-center justify-center border border-indigo-100">
                            R{rnd.round}
                          </div>
                          <div className="text-left">
                            <p className="text-sm md:text-base font-bold text-slate-700">{rnd.name}</p>
                            <p className="text-xs md:text-sm text-slate-500">{rnd.type} • {rnd.questions} Questions</p>
                          </div>
                        </div>
                        <span className="text-xs md:text-sm font-mono text-slate-500">{rnd.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between pt-5 border-t border-slate-100">
                  <span className="text-sm text-slate-500">Interviewer: <strong className="text-slate-700">Aria</strong></span>
                </div>
              </div>
            </Card3D>
          </div>
        </div>
      </main>
    </div>
  );
}
