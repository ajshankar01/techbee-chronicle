"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as microsoftTeams from "@microsoft/teams-js";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Shield, BarChart3, Video, Zap, Users, Lock, LogIn } from "lucide-react";
import DatePicker from "../components/DatePicker";

// HexBackground3D is rendered globally in layout.tsx
const Card3D = dynamic(() => import("../components/Card3D"), { ssr: false });

/**
 * Root landing page — 3D TechBee experience
 * Three.js hex background + CSS 3D tilt cards + Teams SSO routing
 * Falls back to manual login form (email + SAP ID) if not inside Teams.
 */
export default function HomePage() {
  const router = useRouter();
  const [status, setStatus]   = useState("Initializing platform...");
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded]   = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Manual login form state
  const [formEmail, setFormEmail]   = useState("");
  const [formSap, setFormSap]       = useState("");
  const [formName, setFormName]     = useState("");
  const [formRole, setFormRole]     = useState<"candidate" | "hr">("candidate");
  const [formDoj, setFormDoj]       = useState("");
  const [loginErr, setLoginErr]     = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLoaded(true);

    // Animated progress bar
    const steps: [number, string, number][] = [
      [20, "Connecting to Teams...", 500],
      [45, "Authenticating SSO...",  600],
      [70, "Checking your role...",  700],
      [90, "Loading workspace...",   500],
      [100,"Redirecting...",         300],
    ];
    let delay = 0;
    steps.forEach(([p, s, d]) => {
      setTimeout(() => { setProgress(p); setStatus(s); }, delay);
      delay += d;
    });
  }, []);

  useEffect(() => {
    const initTeams = async () => {
      try {
        await microsoftTeams.app.initialize();
        const context = await microsoftTeams.app.getContext();
        const userRole = context.user?.userPrincipalName;
        const token    = await microsoftTeams.authentication.getAuthToken();
        sessionStorage.setItem("teams_token", token);
        sessionStorage.setItem("user_upn", userRole || "");

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const user = await res.json();
          if (user.role === "hr_manager" || user.role === "super_admin") {
            router.replace("/hr/dashboard");
          } else {
            router.replace("/interview");
          }
        } else {
          router.replace("/interview");
        }
      } catch {
        console.warn("Not in Teams context — showing manual login form");
        setShowManual(true);
      }
    };

    const t = setTimeout(initTeams, 2200);
    return () => clearTimeout(t);
  }, [router]);

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;          // guard against double-click
    setLoginErr("");
    if (!formEmail.includes("@")) {
      setLoginErr("Please enter a valid organisation email address.");
      return;
    }
    if (!formSap.trim()) {
      setLoginErr("SAP ID is required.");
      return;
    }
    if (!formName.trim()) {
      setLoginErr("Full name is required.");
      return;
    }
    if (formRole === "candidate" && !formDoj) {
      setLoginErr("Date of Joining is required.");
      return;
    }

    setIsSubmitting(true);             // disable button immediately

    // Store candidate details in sessionStorage
    sessionStorage.setItem("candidate_email",        formEmail.trim().toLowerCase());
    sessionStorage.setItem("candidate_sap_id",       formSap.trim().toUpperCase());
    sessionStorage.setItem("candidate_display_name", formName.trim());
    sessionStorage.setItem("candidate_name",         formName.trim());
    
    if (formRole === "candidate") {
      sessionStorage.setItem("candidate_doj", formDoj);
      // Calculate and store bond year based on DOJ relative to TODAY
      const calculateBondYear = (dojStr: string): number => {
        if (!dojStr) return 1;
        const doj = new Date(dojStr);
        const now = new Date(); // ← always use real current date
        const diffTime = now.getTime() - doj.getTime();
        if (diffTime < 0) return 1; // future DOJ → Module 1
        const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
        if (diffYears < 1.0) return 1;
        if (diffYears < 2.0) return 2;
        return 3;
      };
      const calculatedYear = calculateBondYear(formDoj);
      sessionStorage.setItem("candidate_bond_year", String(calculatedYear));
    } else {
      sessionStorage.removeItem("candidate_doj");
      sessionStorage.removeItem("candidate_bond_year");
    }

    const email = formEmail.trim().toLowerCase();
    sessionStorage.setItem("teams_token",            `dev-token:${email}:${formRole}`);

    if (formRole === "hr") {
      window.location.href = "/hr/dashboard";
    } else {
      window.location.href = "/candidates";
    }
  };


  const features = [
    { icon: Video,    label: "AI Proctored",      desc: "MediaPipe Vision AI",     color: "#4f46e5" },
    { icon: Shield,   label: "Secure & Private",  desc: "Safe · 7-yr retention",   color: "#8b5cf6" },
    { icon: BarChart3,label: "Instant Reports",   desc: "Auto-generated PDF",      color: "#4f46e5" },
    { icon: Users,    label: "HR Portal",         desc: "Bulk review & download",  color: "#8b5cf6" },
    { icon: Zap,      label: "Interactivity",     desc: "Aria conversation engine",color: "#4f46e5" },
    { icon: Lock,     label: "Violation Tracking",desc: "Auto-flagged incidents",  color: "#8b5cf6" },
  ];

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: "transparent" }}>
      {/* HexBackground3D is global */}

      {/* ── Radial overlay for readability ── */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.2) 0%, rgba(241,245,249,0.5) 100%)",
      }} />

      {/* ── Content ── */}
      <div style={{
        position: "relative", zIndex: 2,
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "24px",
      }}>

        {/* ─── Hero Card ─── */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.8s cubic-bezier(0.23,1,0.32,1)",
            width: "100%", maxWidth: 480, marginBottom: 28,
          }}
        >
          <Card3D
            intensity={10}
            glowColor="rgba(79,70,229,0.06)"
            style={{ borderRadius: 24 }}
          >
            <div style={{
              background: "#ffffff",
              border: "1px solid rgba(79, 70, 229, 0.12)",
              borderRadius: 24, padding: "40px 36px", textAlign: "center",
              backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
              boxShadow: "0 10px 30px rgba(79, 70, 229, 0.08), 0 1px 3px rgba(79, 70, 229, 0.03)",
            }}>

              {/* Logo */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <div style={{
                  position: "relative",
                  filter: "drop-shadow(0 4px 10px rgba(79,70,229,0.15))",
                  animation: "logo-float 4s ease-in-out infinite",
                }}>
                  <Image
                    src="/techbee-logo.png"
                    alt="TechBee"
                    width={110}
                    height={110}
                    priority
                    style={{ objectFit: "contain", height: "auto" }}
                  />
                </div>
              </div>

              {/* Heading */}
              <h1 style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: 28, fontWeight: 800, margin: "0 0 6px",
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}>
                Welcome to{" "}
                <span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Techbee Chronicle
                </span>
              </h1>

              <p style={{ color: "#475569", fontSize: 14, margin: "0 0 32px", lineHeight: 1.6 }}>
                Powered by <span style={{ color: "var(--tb-indigo)", fontWeight: 600 }}>Aria</span> — Intelligent Interview & Proctoring Platform
              </p>

              {showManual ? (
                /* ── Manual Login Form ── */
                <form onSubmit={handleManualLogin} style={{ textAlign: "left" }}>
                  {/* Role toggle */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {(["candidate", "hr"] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormRole(r)}
                        style={{
                          flex: 1, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                          cursor: "pointer", transition: "all 0.2s",
                          background: formRole === r ? "rgba(79, 70, 229, 0.1)" : "rgba(79, 70, 229, 0.02)",
                          border: formRole === r ? `1px solid var(--tb-indigo)` : "1px solid rgba(79, 70, 229, 0.1)",
                          color: formRole === r ? "var(--tb-indigo)" : "#64748b",
                        }}
                      >
                        {r === "candidate" ? "👤 Candidate" : "🏢 HR / Admin"}
                      </button>
                    ))}
                  </div>

                  {/* Full Name */}
                  <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 5, fontWeight: 600 }}>FULL NAME</label>
                  <input
                    id="login-name"
                    type="text"
                    placeholder=""
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10, marginBottom: 14,
                      background: "#ffffff", border: "1px solid rgba(79, 70, 229, 0.18)",
                      color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box",
                    }}
                  />

                  {/* Org Email */}
                  <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 5, fontWeight: 600 }}>EMAIL</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder=""
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    required
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10, marginBottom: 14,
                      background: "#ffffff", border: "1px solid rgba(79, 70, 229, 0.18)",
                      color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box",
                    }}
                  />

                  {/* SAP ID */}
                  <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 5, fontWeight: 600 }}>SAP ID</label>
                  <input
                    id="login-sap"
                    type="text"
                    placeholder=""
                    value={formSap}
                    onChange={e => setFormSap(e.target.value.toUpperCase())}
                    required
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10, marginBottom: formRole === "candidate" ? 14 : 6,
                      background: "#ffffff", border: "1px solid rgba(79, 70, 229, 0.18)",
                      color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box",
                      letterSpacing: 1,
                    }}
                  />

                  {/* Date of Joining (Candidates only) */}
                  {formRole === "candidate" && (
                    <>
                      <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 5, fontWeight: 600 }}>DATE OF JOINING</label>
                      <DatePicker value={formDoj} onChange={setFormDoj} />
                    </>
                  )}

                  {loginErr && (
                    <p style={{ color: "#ef4444", fontSize: 11, marginBottom: 14, marginTop: 4 }}>⚠ {loginErr}</p>
                  )}

                  <button
                    id="login-submit"
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      width: "100%", padding: "12px", borderRadius: 12, marginTop: 8,
                      background: isSubmitting ? "#a5b4fc" : "var(--gradient-brand)",
                      border: "none", color: "#ffffff", fontSize: 14, fontWeight: 800,
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: "0 4px 14px rgba(79, 70, 229, 0.25)",
                      transition: "transform 0.15s, box-shadow 0.15s, background 0.2s",
                      opacity: isSubmitting ? 0.75 : 1,
                    }}
                    onMouseEnter={e => { if (!isSubmitting) (e.target as HTMLButtonElement).style.transform = "scale(1.02)"; }}
                    onMouseLeave={e => { (e.target as HTMLButtonElement).style.transform = "scale(1)"; }}
                  >
                    <LogIn size={16} />
                    {isSubmitting ? "Please wait..." : (formRole === "hr" ? "Enter HR Portal" : "Start Interview")}
                  </button>
                </form>
              ) : (
                /* ── Teams SSO Progress ── */
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span style={{ color: "var(--text-muted)", fontSize: 13, marginLeft: 4 }}>{status}</span>
                  </div>
                  <div className="tb-progress">
                    <div className="tb-progress-fill" style={{ width: `${progress}%`, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 10 }}>
                    {progress < 100 ? `Step ${Math.ceil(progress / 25)} of 4` : "✓ Complete"}
                  </p>
                </>
              )}
            </div>
          </Card3D>
        </div>

        {/* ─── Feature Grid ─── */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            width: "100%",
            maxWidth: 480,
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(20px)",
            transition: "all 1s cubic-bezier(0.23,1,0.32,1) 0.3s",
          }}
        >
          {features.map(({ icon: Icon, label, desc, color }, i) => (
            <Card3D
              key={label}
              intensity={12}
              glowColor="rgba(79,70,229,0.06)"
              style={{ borderRadius: 14, animationDelay: `${0.1 + i * 0.05}s` }}
            >
              <div style={{
                background: "#ffffff",
                border: `1px solid rgba(79, 70, 229, 0.12)`,
                borderRadius: 14, padding: "16px 14px", textAlign: "center",
                backdropFilter: "blur(12px)", height: "100%",
                boxShadow: "var(--shadow-card)",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, margin: "0 auto 10px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `rgba(79, 70, 229, 0.08)`, border: `1px solid rgba(79, 70, 229, 0.15)`,
                }}>
                  <Icon size={17} color={color} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>{desc}</div>
              </div>
            </Card3D>
          ))}
        </div>

        {/* Footer */}
        <p style={{
          color: "var(--text-muted)", fontSize: 11, marginTop: 28, textAlign: "center",
          opacity: loaded ? 1 : 0, transition: "opacity 1s 0.8s",
        }}>
          🔒 Secured by Microsoft Teams SSO · Techbee Chronicle Platform
        </p>
      </div>

      <style>{`
        @keyframes logo-float {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
        }
      `}</style>
    </div>
  );
}
