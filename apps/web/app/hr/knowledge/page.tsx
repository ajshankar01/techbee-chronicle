"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  BookOpen, Sparkles, Search, CheckCircle2, ChevronRight,
  Database, RefreshCw, Send, ShieldCheck, Zap,
  FileText, LayoutDashboard, CalendarPlus, HardDrive, Clapperboard, HelpCircle, AlertCircle
} from "lucide-react";
import Card3D from "@/components/Card3D";

interface RetrievedChunk {
  chunk_id: string;
  chunk_index: number;
  section_title: string;
  filename: string;
  content: string;
  token_count: number;
  similarity_score: number;
}

interface QueryResult {
  query: string;
  answer: string;
  retrieved_chunks: RetrievedChunk[];
  metrics: {
    latency_ms: number;
    tokens_saved_estimate: number;
    chunks_retrieved: number;
  };
}

interface RAGStats {
  total_documents: number;
  total_chunks: number;
  documents: { filename: string; chunks: number; id: string }[];
  llm_service: {
    provider: string;
    model: string;
    configured: boolean;
    status: string;
    message?: string;
  };
  recent_queries: {
    query: string;
    latency_ms: number;
    tokens_saved: number;
    created_at: string;
  }[];
}

const SAMPLE_QUESTIONS = [
  "What is the optimal speaking rate (WPM) and deduction for Segment 1 oral communication?",
  "What are the scoring benchmarks and cutoff for Segment 2 cognitive ability?",
  "How does reverse-scoring work for the 7 psychometric questions in Segment 3?",
  "What are the strict penalties for missing salutations and SMS slang in Segment 4 email writing?",
  "What are the proctoring thresholds for tab switches and face visibility?"
];

export default function HRKnowledgeAssistantPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [stats, setStats] = useState<RAGStats | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/api/rag/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn("Failed to fetch RAG stats:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleIngest = async () => {
    setIngesting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/rag/ingest`, { method: "POST" });
      if (res.ok) {
        await fetchStats();
      } else {
        const errData = await res.json();
        setError(errData.detail || "Ingestion failed.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error during ingestion.");
    } finally {
      setIngesting(false);
    }
  };

  const handleSearch = async (targetQuery?: string) => {
    const q = (targetQuery || query).trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, top_k: 3 })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (data.retrieved_chunks && data.retrieved_chunks.length > 0) {
          setExpandedChunkId(data.retrieved_chunks[0].chunk_id);
        }
        await fetchStats();
      } else {
        const errData = await res.json();
        setError(errData.detail || "RAG query failed.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to query RAG assistant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      {/* Sidebar Navigation */}
      <div style={{
        width: 260,
        background: "var(--surface-1, #ffffff)",
        borderRight: "1px solid rgba(79,70,229,0.12)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 50,
        flexShrink: 0,
        boxSizing: "border-box"
      }}>
        {/* Brand Block */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 20px", borderBottom: "1px solid rgba(79,70,229,0.12)" }}>
          <Image src="/techbee-logo.png" alt="TechBee" width={38} height={38} style={{ objectFit: "contain", filter: "drop-shadow(0 4px 10px rgba(79,70,229,0.15))" }} />
          <div>
            <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: 13, color: "var(--text-primary, #0f172a)" }}>
              Tech<span style={{ color: "#4f46e5" }}>bee Chronicle</span>
            </div>
            <div style={{ fontSize: 9, color: "var(--text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              HR Portal
            </div>
          </div>
        </div>

        {/* Menu Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "20px 12px", flex: 1 }}>
          {[
            { label: "Dashboard", href: "/hr/dashboard", active: false, icon: <LayoutDashboard size={16} /> },
            { label: "Schedule",  href: "/hr/schedule",  active: false, icon: <CalendarPlus size={16} /> },
            { label: "Vault",     href: "/hr/vault",     active: false, icon: <HardDrive size={16} /> },
            { label: "Reports",   href: "/hr/reports",   active: false, icon: <FileText size={16} /> },
            { label: "Recordings",href: "/hr/recordings",active: false, icon: <Clapperboard size={16} /> },
            { label: "Questions", href: "/hr/questions", active: false, icon: <HelpCircle size={16} /> },
            { label: "Knowledge Base (RAG)", href: "/hr/knowledge", active: true, icon: <BookOpen size={16} /> },
          ].map(({ label, href, active, icon }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "10px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                background: active ? "rgba(79,70,229,0.08)" : "transparent",
                border: "none",
                borderLeft: active ? "4px solid #4f46e5" : "4px solid transparent",
                paddingLeft: active ? 12 : 16,
                color: active ? "#4f46e5" : "#64748b",
                textAlign: "left",
                transition: "all 0.2s"
              }}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflowY: "auto", minWidth: 0 }}>
        {/* Top Header */}
        <div style={{
          background: "rgba(255,255,255,0.85)",
          borderBottom: "1px solid rgba(79, 70, 229, 0.12)",
          backdropFilter: "blur(20px)",
          padding: "16px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 40
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "rgba(79,70,229,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4f46e5"
            }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, fontFamily: "Space Grotesk, sans-serif" }}>
                Enterprise Knowledge &amp; Evaluation Assistant
              </h1>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                Production-Grade 7-Layer RAG System (Grounded in HCL TechBee 2026 Guidelines)
              </p>
            </div>
          </div>

          <button
            onClick={handleIngest}
            disabled={ingesting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              background: "#4f46e5",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: ingesting ? "not-allowed" : "pointer",
              boxShadow: "0 2px 8px rgba(79,70,229,0.25)"
            }}
          >
            <RefreshCw size={14} className={ingesting ? "animate-spin" : ""} />
            <span>{ingesting ? "Re-Indexing Knowledge Base..." : "Sync & Re-Index raw/ Folder"}</span>
          </button>
        </div>

        <main style={{ padding: "28px 36px", maxWidth: 1400, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          {/* Stats Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 14, border: "1px solid rgba(79,70,229,0.1)" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Indexed Documents</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#4f46e5", marginTop: 4 }}>{stats?.total_documents ?? 0} Docs</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Layer 3: Data Processing</div>
            </div>

            <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 14, border: "1px solid rgba(79,70,229,0.1)" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Semantic Chunks</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0284c7", marginTop: 4 }}>{stats?.total_chunks ?? 0} Chunks</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Layer 4: Vector Store</div>
            </div>

            <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 14, border: "1px solid rgba(79,70,229,0.1)" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Avg Token Reduction</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>~80% Saved</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Dynamic Context Injection</div>
            </div>

            <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 14, border: "1px solid rgba(79,70,229,0.1)" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>LLM Service (Layer 6)</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: stats?.llm_service?.status === "healthy" ? "#16a34a" : "#ea580c", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stats?.llm_service?.status === "healthy" ? "#16a34a" : "#ea580c" }} />
                {stats?.llm_service?.model || "Google Gemini"}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                Status: {stats?.llm_service?.status || "active"}
              </div>
            </div>
          </div>

          {/* Search Bar Block */}
          <div style={{ background: "#ffffff", padding: "24px", borderRadius: 16, border: "1px solid rgba(79,70,229,0.15)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Ask any HR question about HCL TechBee evaluation rubrics, deductions, or benchmarks..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  style={{
                    width: "100%",
                    padding: "14px 16px 14px 46px",
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    color: "#0f172a",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <button
                onClick={() => handleSearch()}
                disabled={loading || !query.trim()}
                style={{
                  padding: "0 24px",
                  background: loading ? "#94a3b8" : "#4f46e5",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "background 0.2s"
                }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                <span>{loading ? "Searching..." : "Ask Assistant"}</span>
              </button>
            </div>

            {/* Suggested Question Chips */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} color="#4f46e5" />
                <span>Suggested Enterprise Inquiries:</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SAMPLE_QUESTIONS.map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(sq);
                      handleSearch(sq);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 20,
                      background: "rgba(79,70,229,0.06)",
                      border: "1px solid rgba(79,70,229,0.15)",
                      color: "#4338ca",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "14px 18px", borderRadius: 10, color: "#dc2626", marginBottom: 24, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Results Grid */}
          {result && (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20, animation: "fade-in 0.4s ease" }}>
              {/* Answer Card */}
              <div style={{ background: "#ffffff", padding: "26px", borderRadius: 16, border: "1px solid rgba(79,70,229,0.15)", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 14, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ShieldCheck size={18} color="#16a34a" />
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>Grounded Policy Response</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, background: "#f0fdf4", color: "#16a34a", padding: "3px 8px", borderRadius: 12, fontWeight: 700 }}>
                      ⚡ {result.metrics.latency_ms} ms
                    </span>
                    <span style={{ fontSize: 11, background: "#eff6ff", color: "#2563eb", padding: "3px 8px", borderRadius: 12, fontWeight: 700 }}>
                      🛡️ ~{result.metrics.tokens_saved_estimate} Tokens Saved
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {result.answer}
                </div>
              </div>

              {/* Retrieved Chunks Card (Source Citations) */}
              <div style={{ background: "#ffffff", padding: "24px", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Source Citations ({result.retrieved_chunks.length} Chunks)
                  </div>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Layer 4: Semantic Cosine Match</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {result.retrieved_chunks.map((chunk) => {
                    const isExpanded = expandedChunkId === chunk.chunk_id;
                    return (
                      <div
                        key={chunk.chunk_id}
                        style={{
                          border: isExpanded ? "1px solid #6366f1" : "1px solid #e2e8f0",
                          background: isExpanded ? "#faf5ff" : "#ffffff",
                          borderRadius: 10,
                          padding: "12px 14px",
                          transition: "all 0.2s"
                        }}
                      >
                        <div
                          onClick={() => setExpandedChunkId(isExpanded ? null : chunk.chunk_id)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <FileText size={14} color="#6366f1" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b" }}>{chunk.section_title}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "2px 6px", borderRadius: 6 }}>
                              Score: {chunk.similarity_score}
                            </span>
                            <ChevronRight size={14} color="#94a3b8" style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(99,102,241,0.15)", fontSize: 12, color: "#475569", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                            {chunk.content}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
