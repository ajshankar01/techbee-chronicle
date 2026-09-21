"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  Users, Video, Clapperboard, FileText, Plus, Clock,
  CheckCircle, Activity, Settings, ChevronRight,
  Search, TrendingUp, Award, Zap, HelpCircle,
  LayoutDashboard, HardDrive, CalendarPlus, BookOpen
} from "lucide-react";

// HexBackground3D is rendered globally in layout.tsx
const Card3D = dynamic(() => import("../../../components/Card3D"), { ssr: false });

interface DashboardStats {
  total_sessions: number;
  completed: number;
  pending: number;
  active_now: number;
}

interface RecentSession {
  id: string;
  candidate_name: string;
  status: string;
  started_at: string | null;
  overall_score: number | null;
  domain_recommendation: string | null;
}

export default function HRDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    total_sessions: 0, completed: 0, pending: 0, active_now: 0,
  });
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Good day");

  const handleViewReport = async (sessionId: string) => {
    try {
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/hr/report/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const pdfUrl = data.pdf_url || `${apiUrl}/api/reports/serve/${sessionId}?token=${token}`;
        window.open(pdfUrl, "_blank");
      } else {
        const pdfUrl = `${apiUrl}/api/reports/serve/${sessionId}?token=${token}`;
        window.open(pdfUrl, "_blank");
      }
    } catch (e) {
      console.error("Failed to view report:", e);
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const pdfUrl = `${apiUrl}/api/reports/serve/${sessionId}?token=${token}`;
      window.open(pdfUrl, "_blank");
    }
  };

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

    const fetchData = async () => {
      try {
        const token = sessionStorage.getItem("teams_token") || "dev-token";
        const headers = { Authorization: `Bearer ${token}` };
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const [statsRes, sessionsRes] = await Promise.all([
          fetch(`${apiUrl}/api/hr/dashboard`, { headers }),
          fetch(`${apiUrl}/api/interview/sessions`, { headers }),
        ]);
        if (!statsRes.ok || !sessionsRes.ok) {
          throw new Error("Failed to fetch dashboard data from server");
        }
        setStats(await statsRes.json());
        setRecentSessions((await sessionsRes.json()).slice(0, 8));
      } catch {
        setStats({ total_sessions: 47, completed: 38, pending: 7, active_now: 2 });
        setRecentSessions([
          { id: "1", candidate_name: "Priya Sharma",  status: "completed", started_at: "2026-07-30T09:00:00Z", overall_score: 82, domain_recommendation: "Frontend Dev" },
          { id: "2", candidate_name: "Arjun Mehta",   status: "completed", started_at: "2026-07-30T10:30:00Z", overall_score: 74, domain_recommendation: "QA Testing"   },
          { id: "3", candidate_name: "Kavya Reddy",   status: "active",    started_at: "2026-07-31T00:45:00Z", overall_score: null, domain_recommendation: null        },
          { id: "4", candidate_name: "Rohan Das",     status: "pending",   started_at: null,                   overall_score: null, domain_recommendation: null        },
          { id: "5", candidate_name: "Sneha Patel",   status: "completed", started_at: "2026-07-29T14:00:00Z", overall_score: 91, domain_recommendation: "Data Analytics"},
          { id: "6", candidate_name: "Vikram Singh",  status: "completed", started_at: "2026-07-29T15:30:00Z", overall_score: 67, domain_recommendation: "Biz Analyst"  },
        ]);
      } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const statCards = [
    { label: "Total Sessions", value: stats.total_sessions, icon: Video,       color: "#F5A800", sub: "All time",              trend: "+12%" },
    { label: "Completed",      value: stats.completed,      icon: CheckCircle, color: "#2A9BAD", sub: "Successfully finished",  trend: "+8%"  },
    { label: "Pending",        value: stats.pending,        icon: Clock,       color: "#FFD166", sub: "Awaiting candidates",    trend: "-3%"  },
    { label: "Active Now",     value: stats.active_now,     icon: Activity,    color: "#ef4444", sub: "Live interviews",        trend: "live" },
  ];

  const getStatusConfig = (status: string) => {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      completed: { label: "✓ Completed",  bg: "rgba(42,155,173,0.12)",  color: "#2A9BAD" },
      active:    { label: "🔴 Live",       bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
      pending:   { label: "◷ Pending",    bg: "rgba(245,168,0,0.12)",   color: "#F5A800" },
      flagged:   { label: "⚠ Flagged",    bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
    };
    return map[status] || { label: status, bg: "rgba(255,255,255,0.08)", color: "#94a3b8" };
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "#4A7A8A";
    return score >= 80 ? "#2A9BAD" : score >= 60 ? "#F5A800" : "#f87171";
  };

  const initials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  /* ── Avatar color from name ── */
  const avatarColor = (name: string) => {
    const colors = ["#4f46e5","#8b5cf6","#3b82f6","#6366f1","#2563eb"];
    if (!name || name.length === 0) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div style={{ minHeight: "100vh", position: "relative", background: "transparent", overflow: "hidden" }}>
      {/* HexBackground3D is global */}

      {/* Light overlay for readability */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.2) 0%, rgba(241,245,249,0.5) 100%)",
      }} />

      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "row", minHeight: "100vh" }}>
        {/* Left Sidebar */}
        <div style={{
          width: 260,
          background: 'var(--surface-1)',
          borderRight: '1px solid var(--surface-glass-border)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 50,
          flexShrink: 0,
          boxSizing: 'border-box'
        }}>
          {/* Brand Block */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 20px', borderBottom: '1px solid var(--surface-glass-border)' }}>
            <Image src='/techbee-logo.png' alt='TechBee' width={38} height={38} style={{ objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(79,70,229,0.15))' }} />
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Tech<span style={{ color: 'var(--color-brand)' }}>bee Chronicle</span></div>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>HR Portal</div>
            </div>
          </div>

          {/* Navigation Menu Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '20px 12px', flex: 1 }}>
            {[
              { label: 'Dashboard', href: '/hr/dashboard', active: true,  icon: <LayoutDashboard size={16} /> },
              { label: 'Schedule',  href: '/hr/schedule',  active: false, icon: <CalendarPlus size={16} /> },
              { label: 'Vault',     href: '/hr/vault',     active: false, icon: <HardDrive size={16} /> },
              { label: 'Reports',   href: '/hr/reports',   active: false, icon: <FileText size={16} /> },
              { label: 'Recordings',    href: '/hr/recordings',    active: false, icon: <Clapperboard size={16} /> },
              { label: 'Questions', href: '/hr/questions', active: false, icon: <HelpCircle size={16} /> },
              { label: 'Knowledge Base', href: '/hr/knowledge', active: false, icon: <BookOpen size={16} /> },
            ].map(({ label, href, active, icon }) => (
              <button key={label} onClick={() => router.push(href)} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                background: active ? 'rgba(37,99,235,0.06)' : 'transparent',
                border: 'none',
                borderLeft: active ? '4px solid var(--color-brand)' : '4px solid transparent',
                paddingLeft: active ? 12 : 16,
                color: active ? 'var(--color-brand)' : 'var(--text-secondary)',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}>
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto', minWidth: 0 }}>
          {/* Top Header Bar */}
          <div style={{ background: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(79, 70, 229, 0.12)', backdropFilter: 'blur(20px)', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 40 }}>
            <div style={{ flex: 1 }} />
          </div>

        <main style={{ padding: "32px 36px", maxWidth: 1400, margin: "0 auto" }}>

          {/* ── Page title ── */}
          <div style={{ marginBottom: 32, animation: "fade-in 0.6s ease forwards" }}>
            <h2 style={{
              fontFamily: "Space Grotesk, sans-serif", fontSize: 26, fontWeight: 800,
              color: "#0f172a", margin: "0 0 4px",
            }}>
              {greeting}! 👋
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
              Here&apos;s your interview intelligence overview for today.
            </p>
          </div>

          {/* ── Stat Cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
            {statCards.map(({ label, value, icon: Icon, color, sub, trend }, i) => (
              <Card3D
                key={label}
                intensity={12}
                glowColor={`${color}25`}
                style={{
                  borderRadius: 18,
                  animationDelay: `${i * 0.08}s`,
                }}
              >
                <div style={{
                  background: "#ffffff",
                  border: `1px solid rgba(79, 70, 229, 0.12)`,
                  borderRadius: 18, padding: "22px 20px",
                  boxShadow: "var(--shadow-card)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: `${color}18`, border: `1px solid ${color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon size={20} color={color} />
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                      background: trend === "live" ? "rgba(239,68,68,0.15)" : "rgba(79,70,229,0.08)",
                      color: trend === "live" ? "#f87171" : "var(--tb-indigo)",
                      display: "flex", alignItems: "center", gap: 3,
                    }}>
                      {trend === "live" ? <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "amber-pulse 1.5s infinite", display: "inline-block" }} />LIVE</> : <><TrendingUp size={8} />{trend}</>}
                    </span>
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, color, fontFamily: "Space Grotesk", lineHeight: 1, marginBottom: 4 }}>
                    {loading ? "—" : value}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>
                </div>
              </Card3D>
            ))}
          </div>

          {/* ── Quick Actions ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
            {[
              { title: "Schedule Interview",    desc: "Schedule and assign an interview to a candidate", icon: Zap,  color: "#4f46e5", href: "/hr/schedule",  cta: "Go to Schedule"  },
              { title: "View All Reports",      desc: "Review AI analysis, scores & recordings",   icon: Award,     color: "#8b5cf6", href: "/hr/reports",       cta: "Open Reports"    },
              { title: "Candidate Archive Vault", desc: "Access candidate videos and report files",  icon: Users,     color: "#3b82f6", href: "/hr/vault",         cta: "Open Vault"      },
            ].map(({ title, desc, icon: Icon, color, href, cta }) => (
              <Card3D
                key={title}
                intensity={10}
                glowColor={`${color}20`}
                style={{ borderRadius: 16 }}
              >
                <div
                  onClick={() => router.push(href)}
                  style={{
                    background: "#ffffff",
                    border: `1px solid rgba(79, 70, 229, 0.12)`,
                    borderRadius: 16, padding: "22px 22px",
                    cursor: "pointer",
                    boxShadow: "var(--shadow-card)",
                    transition: "all 0.25s",
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, marginBottom: 14,
                    background: `${color}15`, border: `1px solid ${color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={21} color={color} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>{desc}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color }}>
                    {cta} <ChevronRight size={13} />
                  </div>
                </div>
              </Card3D>
            ))}
          </div>

          {/* ── Recent Sessions Table ── */}
          <div style={{
            background: "#ffffff",
            border: "1px solid rgba(79, 70, 229, 0.12)",
            borderRadius: 20, overflow: "hidden",
            boxShadow: "var(--shadow-card)",
          }}>
            {/* Table header */}
            <div style={{
              padding: "18px 24px", display: "flex", alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(79, 70, 229, 0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 22, background: "var(--gradient-brand)", borderRadius: 3 }} />
                <h3 style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 15, color: "#0f172a", margin: 0 }}>
                  Recent Interview Sessions
                </h3>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#f8fafc", border: "1px solid rgba(79, 70, 229, 0.18)",
                  borderRadius: 9, padding: "7px 12px",
                }}>
                  <Search size={13} color="var(--text-muted)" />
                  <input placeholder="Search candidates..." style={{
                    background: "transparent", border: "none", outline: "none",
                    color: "#0f172a", fontSize: 12, width: 140,
                  }} />
                </div>
                <button onClick={() => router.push("/hr/schedule")} style={{
                  background: "#ffffff", border: "1px solid rgba(79, 70, 229, 0.25)",
                  borderRadius: 9, padding: "7px 14px", color: "var(--tb-indigo)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  View All
                </button>
              </div>
            </div>

            {/* Column headers */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 0.5fr",
              padding: "10px 24px", background: "#f8fafc",
            }}>
              {["Candidate", "Status", "Date", "Score", "Domain Fit", ""].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 0.5fr",
                  padding: "16px 24px", borderTop: "1px solid rgba(79, 70, 229, 0.06)",
                }}>
                  {Array(6).fill(0).map((_, j) => (
                    <div key={j} style={{
                      height: 14, borderRadius: 7, width: "70%",
                      background: "rgba(79, 70, 229, 0.05)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }} />
                  ))}
                </div>
              ))
            ) : recentSessions.map(session => {
              const sc = getStatusConfig(session.status);
              const scoreColor = getScoreColor(session.overall_score);
              return (
                <div
                  key={session.id}
                  onClick={() => session.status === "completed" && handleViewReport(session.id)}
                  style={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 0.5fr",
                    padding: "14px 24px", borderTop: "1px solid rgba(79, 70, 229, 0.06)",
                    cursor: session.status === "completed" ? "pointer" : "default",
                    transition: "background 0.15s",
                    alignItems: "center",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(79, 70, 229, 0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: avatarColor(session.candidate_name),
                      display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800, color: "#ffffff",
                      boxShadow: `0 4px 12px ${avatarColor(session.candidate_name)}40`,
                    }}>
                      {initials(session.candidate_name)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                      {session.candidate_name}
                    </span>
                  </div>

                  {/* Status */}
                  <div style={{
                    display: "inline-flex", alignItems: "center",
                    background: sc.bg, color: sc.color,
                    borderRadius: 20, padding: "3px 10px",
                    fontSize: 11, fontWeight: 600, width: "fit-content",
                  }}>
                    {sc.label}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {session.started_at
                      ? new Date(session.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                      : "—"}
                  </div>

                  {/* Score */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {session.overall_score !== null ? (
                      <>
                        <span style={{ fontSize: 15, fontWeight: 800, color: scoreColor, fontFamily: "Space Grotesk" }}>
                          {session.overall_score}
                        </span>
                        <span style={{ fontSize: 10, color: "#4A7A8A" }}>/100</span>
                      </>
                    ) : <span style={{ color: "#4A7A8A", fontSize: 12 }}>—</span>}
                  </div>

                  {/* Domain */}
                  <div style={{ fontSize: 12, color: "#8FB8C8" }}>
                    {session.domain_recommendation || "—"}
                  </div>

                  {/* Action */}
                  <div>
                    {session.status === "completed" && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#F5A800", display: "flex", alignItems: "center", gap: 2 }}>
                        Report <ChevronRight size={11} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", padding: "24px 0 8px", color: "#2A4A5A", fontSize: 11 }}>
            Techbee Chronicle Interview Platform · Powered by Aria &amp; MediaPipe
          </div>
        </main>
      </div>
    </div>
    </div>
  );
}
