"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  HelpCircle, Trash2, Plus, Sparkles, Search, Loader2, AlertCircle,
  LayoutDashboard, HardDrive, FileText, Clapperboard, CalendarPlus, BookOpen
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

async function fetchAPI(endpoint: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${API}${endpoint}`, init);
    if (res.status < 500) return res;
    return await fetch(endpoint, init);
  } catch (err) {
    return await fetch(endpoint, init);
  }
}

interface CognitiveQuestion {
  id: string;
  domain: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
}

interface PsychometricQuestion {
  id: string;
  trait: string;
  statement_text: string;
}

export default function QuestionsPage() {
  const router = useRouter();
  
  // UI State
  const [activeTab, setActiveTab] = useState<"cognitive" | "psychometric">("cognitive");
  const [searchQuery, setSearchQuery] = useState("");

  // Data State
  const [cognitiveQs, setCognitiveQs] = useState<CognitiveQuestion[]>([]);
  const [psychometricQs, setPsychometricQs] = useState<PsychometricQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cognitive Form State
  const [cogDomain, setCogDomain] = useState("LOGICAL");
  const [cogText, setCogText] = useState("");
  const [cogOptions, setCogOptions] = useState<string[]>(["", "", "", ""]);
  const [cogCorrect, setCogCorrect] = useState(0);

  // Psychometric Form State
  const [psyTrait, setPsyTrait] = useState("Adaptability");
  const [psyText, setPsyText] = useState("");

  // AI Generated Preview State
  const [generatedCog, setGeneratedCog] = useState<{question_text: string; options: string[]; correct_answer_index: number} | null>(null);
  const [generatedPsy, setGeneratedPsy] = useState<{statement_text: string} | null>(null);

  // Loading States
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      
      const [resCog, resPsy] = await Promise.all([
        fetchAPI("/api/questions/cognitive", { headers: { Authorization: `Bearer ${token}` } }),
        fetchAPI("/api/questions/psychometric", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (resCog.ok) {
        setCognitiveQs(await resCog.json());
      }
      if (resPsy.ok) {
        setPsychometricQs(await resPsy.json());
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleAddCognitive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cogText.trim() || cogOptions.some(o => !o.trim())) return;

    try {
      setAdding(true);
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetchAPI("/api/questions/cognitive", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          domain: cogDomain,
          question_text: cogText,
          options: cogOptions,
          correct_answer_index: cogCorrect
        }),
      });

      if (!res.ok) throw new Error("Failed to add question");
      setCogText("");
      setCogOptions(["", "", "", ""]);
      setCogCorrect(0);
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || "Could not add question");
    } finally {
      setAdding(false);
    }
  };

  const handleAddPsychometric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!psyText.trim()) return;

    try {
      setAdding(true);
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetchAPI("/api/questions/psychometric", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          trait: psyTrait,
          statement_text: psyText
        }),
      });

      if (!res.ok) throw new Error("Failed to add question");
      setPsyText("");
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || "Could not add question");
    } finally {
      setAdding(false);
    }
  };

  const handleAIGenerateCognitive = async () => {
    try {
      setGenerating(true);
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetchAPI(`/api/questions/generate/cognitive?domain=${encodeURIComponent(cogDomain)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("AI generation failed");
      const data = await res.json();
      
      // Show preview inside the AI Generator card
      setGeneratedCog({
        question_text: data.question_text,
        options: data.options || ["", "", "", ""],
        correct_answer_index: data.correct_answer_index !== undefined ? data.correct_answer_index : 0
      });
    } catch (err: any) {
      alert(err.message || "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleAIGeneratePsychometric = async () => {
    try {
      setGenerating(true);
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetchAPI(`/api/questions/generate/psychometric?trait=${encodeURIComponent(psyTrait)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("AI generation failed");
      const data = await res.json();
      
      // Show preview inside the AI Generator card
      setGeneratedPsy({
        statement_text: data.statement_text || data.question_text
      });
    } catch (err: any) {
      alert(err.message || "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGeneratedCognitive = async () => {
    if (!generatedCog) return;
    try {
      setAdding(true);
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetchAPI("/api/questions/cognitive", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          domain: cogDomain,
          question_text: generatedCog.question_text,
          options: generatedCog.options,
          correct_answer_index: generatedCog.correct_answer_index
        }),
      });

      if (!res.ok) throw new Error("Failed to add question");
      setGeneratedCog(null);
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || "Could not add question");
    } finally {
      setAdding(false);
    }
  };

  const handleSaveGeneratedPsychometric = async () => {
    if (!generatedPsy) return;
    try {
      setAdding(true);
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetchAPI("/api/questions/psychometric", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          trait: psyTrait,
          statement_text: generatedPsy.statement_text
        }),
      });

      if (!res.ok) throw new Error("Failed to add statement");
      setGeneratedPsy(null);
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || "Could not add statement");
    } finally {
      setAdding(false);
    }
  };

  const handleAIBatchGenerate = async () => {
    try {
      setGeneratingBatch(true);
      setBatchSuccessMessage(null);
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetchAPI("/api/questions/psychometric/generate-batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("AI Batch Generation failed");
      const data = await res.json();
      setBatchSuccessMessage(data.message || `Successfully generated and ingested ${data.count || 15} questions!`);
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || "AI batch generation failed");
    } finally {
      setGeneratingBatch(false);
    }
  };

  const handleDeleteCognitive = async (id: string) => {
    if (!confirm("Delete this cognitive question?")) return;
    try {
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      await fetchAPI(`/api/questions/cognitive/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      fetchQuestions();
    } catch {}
  };

  const handleDeletePsychometric = async (id: string) => {
    if (!confirm("Delete this psychometric statement?")) return;
    try {
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      await fetchAPI(`/api/questions/psychometric/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      fetchQuestions();
    } catch {}
  };

  const filteredCognitive = cognitiveQs.filter(q => q.question_text?.toLowerCase().includes(searchQuery.toLowerCase()) || q.domain?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredPsychometric = psychometricQs.filter(q => q.statement_text?.toLowerCase().includes(searchQuery.toLowerCase()) || q.trait?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: "transparent", fontFamily: "Inter, sans-serif", color: "var(--text-primary)", display: "flex", flexDirection: "row", position: "relative", overflow: "hidden" }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 20px', borderBottom: '1px solid var(--surface-glass-border)' }}>
          <Image src='/techbee-logo.png' alt='TechBee' width={38} height={38} style={{ objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(79,70,229,0.15))' }} />
          <div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Tech<span style={{ color: 'var(--color-brand)' }}>bee Chronicle</span></div>
            <div style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>HR Portal</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '20px 12px', flex: 1 }}>
          {[
            { label: 'Dashboard', href: '/hr/dashboard', active: false, icon: <LayoutDashboard size={16} /> },
            { label: 'Schedule',  href: '/hr/schedule',  active: false, icon: <CalendarPlus size={16} /> },
            { label: 'Vault',     href: '/hr/vault',     active: false, icon: <HardDrive size={16} /> },
            { label: 'Reports',   href: '/hr/reports',   active: false, icon: <FileText size={16} /> },
            { label: 'Recordings',    href: '/hr/recordings',    active: false, icon: <Clapperboard size={16} /> },
            { label: 'Questions', href: '/hr/questions', active: true,  icon: <HelpCircle size={16} /> },
            { label: 'Knowledge Base (RAG)', href: '/hr/knowledge', active: false, icon: <BookOpen size={16} /> },
          ].map(({ label, href, active, icon }) => (
            <button key={label} onClick={() => router.push(href)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: 13,
              fontWeight: active ? 700 : 500, cursor: 'pointer', background: active ? 'rgba(37,99,235,0.06)' : 'transparent',
              border: 'none', borderLeft: active ? '4px solid var(--color-brand)' : '4px solid transparent', paddingLeft: active ? 12 : 16,
              color: active ? 'var(--color-brand)' : 'var(--text-secondary)', textAlign: 'left', transition: 'all 0.2s',
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

        <div style={{ padding: "32px", maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: 'flex', gap: 20, marginBottom: 24, borderBottom: '1px solid rgba(79,70,229,0.12)' }}>
            <button 
              onClick={() => setActiveTab('cognitive')}
              style={{
                padding: '12px 24px', background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === 'cognitive' ? '3px solid var(--color-brand)' : '3px solid transparent',
                color: activeTab === 'cognitive' ? 'var(--color-brand)' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 15, transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              Cognitive Module (MCQ)
              <span style={{ background: 'var(--color-brand)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 12 }}>{cognitiveQs.length}</span>
            </button>
            <button 
              onClick={() => setActiveTab('psychometric')}
              style={{
                padding: '12px 24px', background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === 'psychometric' ? '3px solid var(--color-brand)' : '3px solid transparent',
                color: activeTab === 'psychometric' ? 'var(--color-brand)' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 15, transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              Psychometric Module (Likert)
              <span style={{ background: 'var(--color-brand)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 12 }}>{psychometricQs.length}</span>
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
            {/* Main Question List */}
            <div style={{ background: "#ffffff", border: "1px solid rgba(79, 70, 229, 0.12)", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)", backdropFilter: "blur(10px)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>{activeTab === 'cognitive' ? 'Cognitive Questions Pool' : 'Psychometric Statements Pool'}</h2>
                
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
                    <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                    <input
                      type="text"
                      placeholder="Search questions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px 8px 32px", fontSize: 13, border: "1px solid var(--surface-glass-border)", borderRadius: 8, outline: "none", background: "rgba(255,255,255,0.5)" }}
                    />
                  </div>
                </div>
              </div>

              {activeTab === 'psychometric' && (
                <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* AI 15-Question Batch Generator Card */}
                  <div style={{
                    padding: "16px 20px",
                    background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                    border: "1.5px solid #ddd6fe",
                    borderRadius: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    boxShadow: "0 2px 10px rgba(124, 58, 237, 0.06)"
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6d28d9", fontWeight: 700, fontSize: 14 }}>
                        <Sparkles size={16} />
                        <span>Automated 15-Question AI Generator</span>
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#5b21b6", lineHeight: 1.45 }}>
                        Generate a balanced set of 15 workplace psychometric statements (3 per trait across all 5 core competencies) and directly ingest them into the Question Bank.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAIBatchGenerate}
                      disabled={generatingBatch}
                      style={{
                        background: "#7c3aed",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 10,
                        padding: "11px 20px",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: generatingBatch ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)"
                      }}
                    >
                      {generatingBatch ? (
                        <>
                          <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                          <span>Generating 15 Items...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={15} />
                          <span>Generate &amp; Add 15 Questions</span>
                        </>
                      )}
                    </button>
                  </div>

                  {batchSuccessMessage && (
                    <div style={{
                      padding: "10px 16px",
                      background: "#ecfdf5",
                      border: "1.5px solid #a7f3d0",
                      borderRadius: 10,
                      color: "#065f46",
                      fontSize: 12,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <span>✓ {batchSuccessMessage}</span>
                      <button 
                        type="button" 
                        onClick={() => setBatchSuccessMessage(null)}
                        style={{ background: "transparent", border: "none", color: "#065f46", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Competency Pool Distribution Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Trait Pool:</span>
                    {["Adaptability", "Resilience", "Collaboration", "Conscientiousness", "Growth Mindset"].map(trait => {
                      const count = psychometricQs.filter(q => q.trait === trait).length;
                      return (
                        <span key={trait} style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: 20,
                          background: count >= 3 ? "#f0fdf4" : "#fef2f2",
                          border: count >= 3 ? "1px solid #bbf7d0" : "1px solid #fecaca",
                          color: count >= 3 ? "#166534" : "#991b1b"
                        }}>
                          {trait}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "60px 0", color: "var(--color-brand)" }}>
                  <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : error ? (
                <div style={{ display: "flex", gap: 10, padding: 20, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 10, color: "#EF4444" }}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              ) : activeTab === 'cognitive' ? (
                filteredCognitive.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)", fontSize: 13 }}>No cognitive questions found.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {filteredCognitive.map(q => (
                      <div key={q.id} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8B5CF6", background: "rgba(139, 92, 246, 0.1)", padding: "2px 8px", borderRadius: 4 }}>
                              {q.domain}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)", fontWeight: 600 }}>{q.question_text}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                            {q.options?.map((opt, i) => (
                              <div key={i} style={{ 
                                padding: '6px 10px', fontSize: 12, borderRadius: 6, 
                                background: i === q.correct_answer_index ? '#d1fae5' : '#ffffff',
                                border: i === q.correct_answer_index ? '1px solid #10b981' : '1px solid #e2e8f0',
                                color: i === q.correct_answer_index ? '#047857' : 'var(--text-secondary)',
                                fontWeight: i === q.correct_answer_index ? 600 : 400
                              }}>
                                {String.fromCharCode(65 + i)}. {opt}
                              </div>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteCognitive(q.id)} style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", opacity: 0.6, padding: 4, borderRadius: 6 }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                filteredPsychometric.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)", fontSize: 13 }}>No psychometric statements found.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {filteredPsychometric.map(q => (
                      <div key={q.id} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#F59E0B", background: "rgba(245, 158, 11, 0.1)", padding: "2px 8px", borderRadius: 4 }}>
                              {q.trait}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)" }}>{q.statement_text}</p>
                        </div>
                        <button onClick={() => handleDeletePsychometric(q.id)} style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", opacity: 0.6, padding: 4, borderRadius: 6 }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Sidebar Forms */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              
              {/* AI Generator Panel */}
              <div style={{ background: "#ffffff", border: "1px solid rgba(79, 70, 229, 0.12)", boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)", borderRadius: 16, padding: 20, backdropFilter: "blur(10px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Sparkles size={16} style={{ color: "var(--color-brand)" }} />
                  <h3 style={{ margin: 0, fontSize: 15, fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, color: "var(--text-primary)" }}>AI Generator</h3>
                </div>
                
                {activeTab === 'cognitive' ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>DOMAIN</label>
                      <select value={cogDomain} onChange={e => setCogDomain(e.target.value)} style={{ width: "100%", padding: 9, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box" }}>
                        <option value="LOGICAL">LOGICAL</option>
                        <option value="PERCEPTUAL">PERCEPTUAL</option>
                        <option value="NUMERICAL">NUMERICAL</option>
                        <option value="VERBAL">VERBAL</option>
                      </select>
                    </div>
                    <button type="button" onClick={handleAIGenerateCognitive} disabled={generating} style={{ width: "100%", background: "var(--gradient-brand)", color: "#ffffff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {generating ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating...</> : <><Sparkles size={14} /> Generate MCQ</>}
                    </button>
                    {generatedCog && (
                      <div style={{ marginTop: 16, padding: 12, border: "1px dashed var(--color-brand)", borderRadius: 8, background: "#f8fafc" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, marginTop: 0 }}>Preview:</p>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, marginTop: 0 }}>{generatedCog.question_text}</p>
                        <ul style={{ paddingLeft: 20, margin: 0, fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                          {generatedCog.options.map((opt, i) => (
                            <li key={i} style={{ fontWeight: i === generatedCog.correct_answer_index ? 700 : 400, color: i === generatedCog.correct_answer_index ? "var(--color-success)" : "inherit" }}>{opt}</li>
                          ))}
                        </ul>
                        <button type="button" onClick={handleSaveGeneratedCognitive} disabled={adding} style={{ width: "100%", background: "var(--color-success)", color: "#ffffff", border: "none", borderRadius: 8, padding: "8px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                          {adding ? "Saving..." : "Add question to bank"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>TRAIT</label>
                      <select value={psyTrait} onChange={e => setPsyTrait(e.target.value)} style={{ width: "100%", padding: 9, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box" }}>
                        <option value="Adaptability">Adaptability</option>
                        <option value="Resilience">Resilience</option>
                        <option value="Collaboration">Collaboration</option>
                        <option value="Conscientiousness">Conscientiousness</option>
                        <option value="Growth Mindset">Growth Mindset</option>
                      </select>
                    </div>
                    <button type="button" onClick={handleAIGeneratePsychometric} disabled={generating} style={{ width: "100%", background: "var(--gradient-brand)", color: "#ffffff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {generating ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating...</> : <><Sparkles size={14} /> Generate Statement</>}
                    </button>
                    {generatedPsy && (
                      <div style={{ marginTop: 16, padding: 12, border: "1px dashed var(--color-brand)", borderRadius: 8, background: "#f8fafc" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, marginTop: 0 }}>Preview:</p>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, marginTop: 0 }}>{generatedPsy.statement_text}</p>
                        <button type="button" onClick={handleSaveGeneratedPsychometric} disabled={adding} style={{ width: "100%", background: "var(--color-success)", color: "#ffffff", border: "none", borderRadius: 8, padding: "8px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                          {adding ? "Saving..." : "Add statement to bank"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Manual Insert Panel */}
              <form id="manual-add-form" onSubmit={activeTab === 'cognitive' ? handleAddCognitive : handleAddPsychometric} style={{ background: "#ffffff", border: "1px solid rgba(79, 70, 229, 0.12)", boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)", borderRadius: 16, padding: 20, backdropFilter: "blur(10px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Plus size={16} style={{ color: "var(--color-brand)" }} />
                  <h3 style={{ margin: 0, fontSize: 15, fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, color: "var(--text-primary)" }}>Manual Add</h3>
                </div>
                
                {activeTab === 'cognitive' ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>DOMAIN</label>
                      <select value={cogDomain} onChange={e => setCogDomain(e.target.value)} style={{ width: "100%", padding: 9, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box" }}>
                        <option value="LOGICAL">LOGICAL</option>
                        <option value="PERCEPTUAL">PERCEPTUAL</option>
                        <option value="NUMERICAL">NUMERICAL</option>
                        <option value="VERBAL">VERBAL</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>QUESTION TEXT</label>
                      <textarea rows={3} value={cogText} onChange={e => setCogText(e.target.value)} style={{ width: "100%", padding: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>OPTIONS</label>
                      {cogOptions.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                          <input type="radio" name="cogCorrect" checked={cogCorrect === i} onChange={() => setCogCorrect(i)} />
                          <input value={opt} onChange={e => {
                            const newOpts = [...cogOptions];
                            newOpts[i] = e.target.value;
                            setCogOptions(newOpts);
                          }} style={{ flex: 1, padding: 8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, outline: "none" }} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                        </div>
                      ))}
                    </div>
                    <button type="submit" disabled={adding || !cogText.trim()} style={{ width: "100%", background: "rgba(79, 70, 229, 0.08)", border: "1px solid rgba(79, 70, 229, 0.15)", color: "var(--color-brand)", borderRadius: 8, padding: "10px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: !cogText.trim() ? 0.5 : 1 }}>
                      {adding ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Adding...</> : <><Plus size={14} /> Save Question</>}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>TRAIT</label>
                      <select value={psyTrait} onChange={e => setPsyTrait(e.target.value)} style={{ width: "100%", padding: 9, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box" }}>
                        <option value="Adaptability">Adaptability</option>
                        <option value="Resilience">Resilience</option>
                        <option value="Collaboration">Collaboration</option>
                        <option value="Conscientiousness">Conscientiousness</option>
                        <option value="Growth Mindset">Growth Mindset</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>STATEMENT TEXT</label>
                      <textarea rows={4} value={psyText} onChange={e => setPsyText(e.target.value)} style={{ width: "100%", padding: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                    </div>
                    <button type="submit" disabled={adding || !psyText.trim()} style={{ width: "100%", background: "rgba(79, 70, 229, 0.08)", border: "1px solid rgba(79, 70, 229, 0.15)", color: "var(--color-brand)", borderRadius: 8, padding: "10px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: !psyText.trim() ? 0.5 : 1 }}>
                      {adding ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Adding...</> : <><Plus size={14} /> Save Statement</>}
                    </button>
                  </div>
                )}
              </form>

            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
