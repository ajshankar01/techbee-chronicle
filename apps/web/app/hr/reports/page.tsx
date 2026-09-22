'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Search, RefreshCw, FileText, Download,
  Calendar, CheckCircle2, AlertTriangle,
  XCircle, Edit3, X, Save, ExternalLink, Video, Clapperboard, Play,
  Printer, PackageOpen, SlidersHorizontal, Filter,
  LayoutDashboard, Clock, HardDrive, HelpCircle,
  List, Grid, CalendarPlus, BarChart3, Tag, TrendingUp, MessageSquare, Star, ChevronDown, ChevronUp, BookOpen, Trash2} from 'lucide-react';
import Card3D from '@/components/Card3D';

// HexBackground3D is rendered globally in layout.tsx

interface S3Report {
  sap_id: string;
  candidate_name: string;
  session_id: string;
  timestamp: string;
  timestamp_display: string;
  size_kb: number;
  presign_url: string;
  s3_key: string;
  bond_year?: number;
}

interface S3Candidate {
  sap_id: string;
  candidate_name: string;
  reports: S3Report[];
  latest_report_url: string | null;
  latest_video_url: string | null;
}

interface HRNote {
  text: string;
  author: string;
  timestamp: string;
}

type FilterType = 'All' | 'Pass' | 'Needs Review' | 'Fail';

function getStatusFromScore(score: number | null): { label: FilterType; color: string; bg: string; icon: React.ReactNode } {
  if (score === null) return { label: 'Needs Review', color: '#b45309', bg: '#fef3c7', icon: <AlertTriangle size={13} /> };
  if (score >= 80) return { label: 'Pass', color: '#047857', bg: '#d1fae5', icon: <CheckCircle2 size={13} /> };
  if (score >= 60) return { label: 'Needs Review', color: '#b45309', bg: '#fef3c7', icon: <AlertTriangle size={13} /> };
  return { label: 'Fail', color: '#b91c1c', bg: '#fee2e2', icon: <XCircle size={13} /> };
}

function VideoModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#ffffff', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 900, boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={16} color='#4f46e5' />
            </div>
            <div className="text-left">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Interview Recording</h2>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{name}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={url} download style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 8, padding: '7px 14px', color: 'var(--color-brand)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontWeight: 'bold' }}>
              <Download size={13} /> Download
            </a>
            <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '7px 10px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>
        <video src={url} controls autoPlay style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: '65vh' }} />
        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#64748b', textAlign: 'center' }}>
          Stored securely in Cloud Vault (7-year retention). HR review only.
        </p>
      </div>
    </div>
  );
}

// ── Detailed Analysis Modal ──────────────────────────────────────────────────
interface PerQuestionItem {
  question_index: number;
  question_text: string;
  keywords_mentioned: string[];
  topics_covered: string[];
  evidence_quotes: string[];
  depth_assessment: string;
  fit_indicator: 'Fit' | 'Neutral' | 'Concern';
  fit_reason: string;
}

interface TranscriptKeywordMap {
  technical_keywords: string[];
  soft_skill_keywords: string[];
  domain_signals: string[];
  positive_indicators: string[];
  concern_indicators: string[];
}

interface FullAnalysisData {
  scores: Record<string, number>;
  overall_score: number;
  mindset_label: string;
  attitude_label: string;
  summary_text: string;
  domain_recommendation: string;
  secondary_domain: string;
  strengths: string[];
  areas_of_improvement: string[];
  red_flags: string[];
  per_question_analysis: PerQuestionItem[];
  transcript_keyword_map: TranscriptKeywordMap;
  fit_verdict: string;
  fit_verdict_reason: string;
  executive_summary: string;
  hr_action_plan: string[];
  candidate_archetype: string;
  archetype_description: string;
  retention_risk: string;
  evasion_score: number;
  tone_map: { question_index: number; tone: string; evidence: string }[];
}

function FitBadge({ verdict }: { verdict: string }) {
  const colors: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    'Recommended':               { bg: '#d1fae5', color: '#047857', icon: <CheckCircle2 size={13} /> },
    'Conditionally Recommended': { bg: '#fef3c7', color: '#b45309', icon: <AlertTriangle size={13} /> },
    'Not Recommended':           { bg: '#fee2e2', color: '#b91c1c', icon: <XCircle size={13} /> },
  };
  const c = colors[verdict] || colors['Conditionally Recommended'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: c.bg, color: c.color,
      padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
      {c.icon} {verdict}
    </span>
  );
}

function QuestionCard({ q, tone }: { q: PerQuestionItem; tone?: { tone: string; evidence: string } }) {
  const [open, setOpen] = useState(false);
  const fitColors: Record<string, string> = {
    'Fit': '#047857', 'Neutral': '#b45309', 'Concern': '#b91c1c'
  };
  const fitBgs: Record<string, string> = {
    'Fit': '#d1fae5', 'Neutral': '#fef3c7', 'Concern': '#fee2e2'
  };
  const color = fitColors[q.fit_indicator] || '#6366f1';
  const bg = fitBgs[q.fit_indicator] || '#f0f0ff';
  return (
    <div style={{ border: '1px solid rgba(79,70,229,0.12)', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          background: open ? 'rgba(99,102,241,0.04)' : '#fff', border: 'none', cursor: 'pointer',
          textAlign: 'left', transition: 'background 0.15s' }}>
        <span style={{ fontWeight: 800, fontSize: 11, color: '#4f46e5', background: 'rgba(79,70,229,0.1)',
          borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>Q{q.question_index}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>{q.question_text}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color,
          padding: '2px 10px', borderRadius: 20, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
          {q.fit_indicator === 'Fit' ? <CheckCircle2 size={10} /> : q.fit_indicator === 'Concern' ? <XCircle size={10} /> : <AlertTriangle size={10} />}
          {q.fit_indicator}
        </span>
        {open ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Keywords */}
          {q.keywords_mentioned?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Keywords Mentioned</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {q.keywords_mentioned.map((kw, i) => (
                  <span key={i} style={{ background: 'rgba(99,102,241,0.08)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{kw}</span>
                ))}
              </div>
            </div>
          )}
          {/* Topics */}
          {q.topics_covered?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Topics Covered</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {q.topics_covered.map((t, i) => (
                  <span key={i} style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {/* Evidence Quotes */}
          {q.evidence_quotes?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Evidence from Transcript</div>
              {q.evidence_quotes.map((eq, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid rgba(79,70,229,0.1)', borderLeft: '3px solid #6366f1', borderRadius: '0 8px 8px 0', padding: '8px 12px', fontSize: 12, color: '#374151', fontStyle: 'italic', marginBottom: 4 }}>{eq}</div>
              ))}
            </div>
          )}
          {/* Tone */}
          {tone && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0, paddingTop: 2 }}>Tone:</span>
              <span style={{ fontSize: 12, color: '#374151' }}><strong style={{ color: '#4f46e5' }}>{tone.tone}</strong> — {tone.evidence}</span>
            </div>
          )}
          {/* Depth + Fit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Depth</div>
              <div style={{ fontSize: 12, color: '#374151' }}>{q.depth_assessment}</div>
            </div>
            <div style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Fit Reason</div>
              <div style={{ fontSize: 12, color: '#374151' }}>{q.fit_reason}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisModal({ sessionId, candidateName, onClose }: { sessionId: string; candidateName: string; onClose: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<{ report: { overall_score: number; domain_recommendation: string; is_flagged: boolean }; analysis: FullAnalysisData } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('teams_token') || 'dev-token';
    fetch(`/api/reports/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load'))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [sessionId]);

  const a = data?.analysis;
  const r = data?.report;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 860, boxShadow: '0 24px 80px rgba(79,70,229,0.22)',
        border: '1px solid rgba(79,70,229,0.15)', overflow: 'hidden', marginBottom: 24 }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', gap: 14,
          background: 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(124,58,237,0.04))' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 size={20} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a', fontFamily: 'Space Grotesk, sans-serif' }}>Evaluation Report</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>{candidateName} · Session {sessionId.substring(0, 12)}...</p>
          </div>
          <button
            onClick={() => router.push(`/hr/reports/${sessionId}?name=${encodeURIComponent(candidateName)}`)}
            style={{ background: '#6366f1', border: 'none', borderRadius: 8, padding: '7px 13px', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
          >
            <ExternalLink size={13} /> Open Full Suite
          </button>
          {r && <FitBadge verdict={a?.fit_verdict || 'Conditionally Recommended'} />}
          <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}><X size={16} color="#64748b" /></button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}><RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 10, display: 'block', margin: '0 auto 10px' }} /><p>Loading analysis...</p></div>}
          {error && <div style={{ textAlign: 'center', padding: 40, color: '#b91c1c' }}><XCircle size={28} style={{ marginBottom: 10, display: 'block', margin: '0 auto 10px' }} /><p>{error}</p><p style={{ fontSize: 12, color: '#64748b' }}>Try completing the interview first to generate an analysis.</p></div>}

          {a && !loading && (<>

            {/* Executive Summary */}
            {a.executive_summary && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', marginBottom: 8 }}>Executive Summary</div>
                <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.05),rgba(124,58,237,0.03))', border: '1px solid rgba(79,70,229,0.12)', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: '#1e293b', lineHeight: 1.7 }}>{a.executive_summary}</div>
              </div>
            )}

            {/* Fit Verdict */}
            {a.fit_verdict && (
              <div style={{ background: a.fit_verdict === 'Recommended' ? '#f0fdf4' : a.fit_verdict === 'Not Recommended' ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${a.fit_verdict === 'Recommended' ? '#bbf7d0' : a.fit_verdict === 'Not Recommended' ? '#fecaca' : '#fde68a'}`, borderRadius: 12, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <FitBadge verdict={a.fit_verdict} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Overall Session Verdict</span>
                </div>
                {a.fit_verdict_reason && <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{a.fit_verdict_reason}</p>}
              </div>
            )}

            {/* Score Grid */}
            {a.scores && Object.keys(a.scores).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', marginBottom: 10 }}>Scores</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                  {Object.entries(a.scores).map(([k, v]) => (
                    <div key={k} style={{ background: '#f8fafc', border: '1px solid rgba(79,70,229,0.1)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: v >= 80 ? '#047857' : v >= 60 ? '#b45309' : '#b91c1c' }}>{v}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, textTransform: 'capitalize' }}>{k.replace('_', ' ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keyword Map */}
            {a.transcript_keyword_map && Object.keys(a.transcript_keyword_map).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', marginBottom: 10 }}>Transcript Keyword Map</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(a.transcript_keyword_map).map(([cat, words]) => (
                    Array.isArray(words) && words.length > 0 && (
                      <div key={cat}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'capitalize', letterSpacing: '0.05em' }}>{cat.replace(/_/g, ' ')}</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {(words as string[]).map((w, i) => {
                            const isPositive = cat === 'positive_indicators';
                            const isConcern = cat === 'concern_indicators';
                            return (
                              <span key={i} style={{ background: isPositive ? '#d1fae5' : isConcern ? '#fee2e2' : 'rgba(99,102,241,0.08)',
                                color: isPositive ? '#047857' : isConcern ? '#b91c1c' : '#4f46e5',
                                border: `1px solid ${isPositive ? '#bbf7d0' : isConcern ? '#fecaca' : 'rgba(99,102,241,0.15)'}`,
                                borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{w}</span>
                            );
                          })}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Per-Question Analysis */}
            {a.per_question_analysis?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', marginBottom: 10 }}>Per-Question Evidence Analysis</div>
                {a.per_question_analysis.map(q => (
                  <QuestionCard
                    key={q.question_index}
                    q={q}
                    tone={a.tone_map?.find(t => t.question_index === q.question_index)}
                  />
                ))}
              </div>
            )}

            {/* HR Action Plan */}
            {a.hr_action_plan?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', marginBottom: 8 }}>HR Action Plan</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {a.hr_action_plan.map((action, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, background: '#f8fafc', border: '1px solid rgba(79,70,229,0.08)', borderRadius: 10, padding: '10px 14px' }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: '#6366f1', flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths + Areas of Improvement */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {a.strengths?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#047857', marginBottom: 8 }}>Strengths</div>
                  {a.strengths.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <CheckCircle2 size={13} color="#047857" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#374151' }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}
              {a.areas_of_improvement?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#b45309', marginBottom: 8 }}>Areas of Improvement</div>
                  {a.areas_of_improvement.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <TrendingUp size={13} color="#b45309" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#374151' }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </>)}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<S3Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('All');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [videoModal, setVideoModal] = useState<{ url: string; name: string } | null>(null);
  const [analysisModal, setAnalysisModal] = useState<{ sessionId: string; candidateName: string } | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [dlStatuses, setDlStatuses] = useState<string[]>(['Pass', 'Needs Review', 'Fail']);
  const [dlModules, setDlModules] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  const [purging, setPurging] = useState(false);

  const handlePurgeAll = async () => {
    if (!window.confirm("Are you sure you want to delete all existing reports, recordings, and candidate profiles?")) {
      return;
    }
    setPurging(true);
    try {
      localStorage.removeItem('latest_completed_interview_session');
      localStorage.removeItem('interview_session_history');
      localStorage.removeItem('latest_interview_analysis');
      localStorage.removeItem('latest_interview_sap');
      
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('hr_note_') || k.startsWith('candidate_') || k.startsWith('session_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetch('/api/s3-list', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCandidates([]);
        alert("All existing reports, recordings, and profiles have been deleted.");
        fetchData();
      } else {
        alert("Cleared local items, but server purge encountered an error.");
        fetchData();
      }
    } catch (err) {
      console.error("Purge error:", err);
      alert("Error while purging items.");
    } finally {
      setPurging(false);
    }
  };

  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const handleRegenerate = async (sessionId: string, candidateName: string, sapId: string, videoUrl: string) => {
    setRegeneratingId(sessionId);
    try {
      const token = sessionStorage.getItem('teams_token') || 'dev-token';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      const reportRes = await fetch(`${apiUrl}/api/reports/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let transcript = [];
      let scores: Record<string, number> = {};
      let candEmail = '';
      let startTime = '';
      let violationCount = 0;
      let violationLog: any[] = [];
      if (reportRes.ok) {
        const data = await reportRes.json();
        transcript = data.full_transcript || data.transcript || [];
        scores = data.analysis?.scores || {};
        candEmail = data.candidate?.email || '';
        startTime = data.session?.started_at || '';
        
        violationCount = data.analysis?.violation_count || 0;
        violationLog = data.analysis?.violation_log || [];
      }

      const reqBody = {
        candidate_name: candidateName,
        candidate_email: candEmail || `${candidateName.replace(/\s+/g, '').toLowerCase()}@techbee.in`,
        sap_id: sapId,
        interviewed_at: startTime || new Date().toISOString(),
        s3_video_url: videoUrl,
        transcript: transcript,
        behavioral_summary: {
           eye_contact_avg: scores.eye_contact || 80,
           adaptability_score: scores.adaptability || 75,
           engagement_score: 75,
           nervousness_score: 20,
           posture_score: scores.body_language || 77,
           smile_score: 60,
           stress_score: 25,
           overall_behavior_score: scores.cultural_fit || 80,
           violation_count: violationCount,
           violation_log: violationLog
        }
      };

      const res = await fetch(`${apiUrl}/api/reports/${sessionId}/generate-pdf?template_id=0`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(reqBody)
      });
      if (res.ok) {
        alert('PDF Regenerated successfully! Click "Sync Vault" to update the list.');
      } else {
        alert('Failed to regenerate PDF.');
      }
    } catch (e) {
      console.error(e);
      alert('Error regenerating PDF.');
    } finally {
      setRegeneratingId(null);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('view_mode_reports') as 'list' | 'grid';
    if (saved) setViewMode(saved);
  }, []);

  const handleSetViewMode = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('view_mode_reports', mode);
  };

  const bulkRef = useRef<HTMLAnchorElement>(null);

  const getScore = (sapId: string): number | null => {
    if (sapId === localStorage.getItem('latest_interview_sap') || sapId === 'SAP100492') {
      try { const a = localStorage.getItem('latest_interview_analysis'); return a ? JSON.parse(a)?.overall_score || null : null; }
      catch { return null; }
    }
    return null;
  };

  const getNote = (key: string): HRNote | null => {
    try { const raw = localStorage.getItem(`hr_note_${key}`); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  };

  const saveNote = (key: string, text: string) => {
    const note: HRNote = { text, author: 'HR Reviewer', timestamp: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) };
    localStorage.setItem(`hr_note_${key}`, JSON.stringify(note));
    setEditingKey(null); setNoteText('');
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const localSessions: { sap_id: string; candidate_name: string; session_id: string; pdf_url?: string; s3_url?: string; date?: string }[] = [];
    try { const raw = localStorage.getItem('latest_completed_interview_session'); if (raw) { const s = JSON.parse(raw); localSessions.push(s); localStorage.setItem('latest_interview_sap', s.sap_id || ''); } } catch {}
    try { const h = localStorage.getItem('interview_session_history'); if (h) { const hist = JSON.parse(h); if (Array.isArray(hist)) localSessions.push(...hist.slice(0, 20)); } } catch {}
    try {
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetch('/api/s3-list', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        const merged: S3Candidate[] = data.candidates || [];
        for (const local of localSessions) {
          if (!local.sap_id) continue;
          const exists = merged.find(c => c.sap_id === local.sap_id);
          if (!exists) {
            merged.push({ sap_id: local.sap_id, candidate_name: local.candidate_name || 'Candidate', reports: local.pdf_url ? [{ sap_id: local.sap_id, candidate_name: local.candidate_name, session_id: local.session_id, timestamp: '99999999_999999', timestamp_display: local.date || 'Recent', size_kb: 0, presign_url: local.pdf_url, s3_key: '' }] : [], latest_report_url: local.pdf_url || null, latest_video_url: local.s3_url || null });
          } else {
            const alreadyHasReport = exists.reports.some(r => 
              r.session_id === local.session_id || 
              local.session_id.startsWith(r.session_id) || 
              r.session_id.startsWith(local.session_id) ||
              (r.timestamp_display && local.date && (
                r.timestamp_display.toLowerCase().replace(/[^a-z0-9]/g, '').includes(local.date.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
                local.date.toLowerCase().replace(/[^a-z0-9]/g, '').includes(r.timestamp_display.toLowerCase().replace(/[^a-z0-9]/g, ''))
              ))
            );
            if (!alreadyHasReport && local.pdf_url) {
              if (!exists.latest_report_url) {
                exists.latest_report_url = local.pdf_url;
              }
              exists.reports.unshift({ sap_id: local.sap_id, candidate_name: local.candidate_name, session_id: local.session_id, timestamp: '99999999_999998', timestamp_display: local.date || 'Recent', size_kb: 0, presign_url: local.pdf_url, s3_key: '' });
            }
            if (local.s3_url && !exists.latest_video_url) {
              exists.latest_video_url = local.s3_url;
            }
          }
        }
        setCandidates(merged);
      } else throw new Error('non-ok');
    } catch {
      const seenSap = new Set<string>();
      setCandidates(localSessions.filter(s => s.sap_id && !seenSap.has(s.sap_id) && !!seenSap.add(s.sap_id)).map(s => ({ sap_id: s.sap_id, candidate_name: s.candidate_name || 'Candidate', reports: s.pdf_url ? [{ sap_id: s.sap_id, candidate_name: s.candidate_name, session_id: s.session_id, timestamp: '99999999_999999', timestamp_display: s.date || 'Recent', size_kb: 0, presign_url: s.pdf_url, s3_key: '' }] : [], latest_report_url: s.pdf_url || null, latest_video_url: s.s3_url || null })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allReports = candidates.flatMap(c => c.reports.map(r => ({ ...r, candidate_name: c.candidate_name, sap_id: c.sap_id, video_url: c.latest_video_url || '' }))).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const filtered = allReports.filter(r => {
    const matchSearch = r.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) || r.sap_id.toLowerCase().includes(searchQuery.toLowerCase()) || r.session_id.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'All') return true;
    return getStatusFromScore(getScore(r.sap_id)).label === filter;
  });

  const getFilteredForDownload = () => {
    return allReports.filter(r => {
      if (!r.presign_url) return false;
      const status = getStatusFromScore(getScore(r.sap_id)).label;
      if (!dlStatuses.includes(status)) return false;
      const mod = r.bond_year || 1;
      if (!dlModules.includes(mod)) return false;
      return true;
    });
  };

  const handleBulkDownload = async () => {
    const pdfReports = getFilteredForDownload();
    if (!pdfReports.length) return;
    setShowDownloadModal(false);
    setBulkDownloading(true);
    for (const report of pdfReports) {
      const a = document.createElement('a');
      a.href = report.presign_url;
      a.download = `Report_${report.candidate_name.replace(/\s+/g, '_')}_Module${report.bond_year || 1}_${report.session_id.slice(0, 8)}.pdf`;
      a.target = '_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      await new Promise(r => setTimeout(r, 650));
    }
    setBulkDownloading(false);
  };

  const toggleDlStatus = (s: string) =>
    setDlStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleDlModule = (m: number) =>
    setDlModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  const allStatusesOn = dlStatuses.length === 3;
  const allModulesOn  = dlModules.length  === 6;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)',
      display: 'flex', flexDirection: 'row', position: 'relative', overflow: 'hidden' }}>
      {/* HexBackground3D is global */}
      {videoModal && <VideoModal url={videoModal.url} name={videoModal.name} onClose={() => setVideoModal(null)} />}
      {analysisModal && <AnalysisModal sessionId={analysisModal.sessionId} candidateName={analysisModal.candidateName} onClose={() => setAnalysisModal(null)} />}
      <a ref={bulkRef} style={{ display: 'none' }} />

      {/* ── Download Filter Modal ── */}
      {showDownloadModal && (() => {
        const matchCount = getFilteredForDownload().length;
        const STATUS_META: { key: string; color: string; bg: string; icon: React.ReactNode }[] = [
          { key: 'Pass',         color: '#047857', bg: '#d1fae5', icon: <CheckCircle2 size={13} /> },
          { key: 'Needs Review', color: '#b45309', bg: '#fef3c7', icon: <AlertTriangle size={13} /> },
          { key: 'Fail',         color: '#b91c1c', bg: '#fee2e2', icon: <XCircle size={13} /> },
        ];
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={e => { if (e.target === e.currentTarget) setShowDownloadModal(false); }}
          >
            <div style={{ background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 24px 80px rgba(79,70,229,0.18)', border: '1px solid rgba(79,70,229,0.15)', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SlidersHorizontal size={18} color='#fff' />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>Customise Download</h2>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Select which reports to include in the batch download</p>
                </div>
                <button onClick={() => setShowDownloadModal(false)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                  <X size={16} color='#64748b' />
                </button>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Status filter */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)' }}>Filter by Status</p>
                    <button
                      onClick={() => setDlStatuses(allStatusesOn ? [] : ['Pass', 'Needs Review', 'Fail'])}
                      style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {allStatusesOn ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {STATUS_META.map(({ key, color, bg, icon }) => {
                      const on = dlStatuses.includes(key);
                      return (
                        <button key={key} onClick={() => toggleDlStatus(key)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${on ? color : '#e2e8f0'}`, background: on ? bg : '#fafafa', cursor: 'pointer', transition: 'all 0.15s', fontSize: 12, fontWeight: 700, color: on ? color : '#94a3b8' }}>
                          <span style={{ display: 'flex', alignItems: 'center', width: 16, height: 16, borderRadius: 4, border: `2px solid ${on ? color : '#cbd5e1'}`, background: on ? color : 'transparent', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                            {on && <span style={{ color: '#fff', fontSize: 9, fontWeight: 900 }}>✓</span>}
                          </span>
                          <span style={{ color: on ? color : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>{icon} {key}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Module filter */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)' }}>Filter by Module</p>
                    <button
                      onClick={() => setDlModules(allModulesOn ? [] : [1,2,3,4,5,6])}
                      style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {allModulesOn ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {[1,2,3,4,5,6].map(m => {
                      const on = dlModules.includes(m);
                      const colors = ['#10b981','#6366f1','#f59e0b','#0ea5e9','#8b5cf6','#ef4444'];
                      const bgs   = ['rgba(16,185,129,0.08)','rgba(99,102,241,0.08)','rgba(245,158,11,0.08)','rgba(14,165,233,0.08)','rgba(139,92,246,0.08)','rgba(239,68,68,0.08)'];
                      const c = colors[m-1];
                      const bg = bgs[m-1];
                      return (
                        <button key={m} onClick={() => toggleDlModule(m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${on ? c : '#e2e8f0'}`, background: on ? bg : '#fafafa', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 4, border: `2px solid ${on ? c : '#cbd5e1'}`, background: on ? c : 'transparent', flexShrink: 0, transition: 'all 0.15s' }}>
                            {on && <span style={{ color: '#fff', fontSize: 9, fontWeight: 900 }}>✓</span>}
                          </span>
                          <div>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: on ? c : '#94a3b8' }}>Module {m}</p>
                            <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>Year {m}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live count + CTA */}
                <div style={{ borderTop: '1px solid rgba(79,70,229,0.1)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: matchCount > 0 ? 'rgba(99,102,241,0.06)' : 'rgba(0,0,0,0.03)', border: `1px solid ${matchCount > 0 ? 'rgba(99,102,241,0.18)' : '#e2e8f0'}` }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: matchCount > 0 ? 'var(--color-brand)' : '#94a3b8' }}>
                      {matchCount} report{matchCount !== 1 ? 's' : ''} matched
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {matchCount > 0 ? 'Will be downloaded as individual PDFs' : 'Adjust filters above to match reports'}
                    </p>
                  </div>
                  <button
                    onClick={handleBulkDownload}
                    disabled={matchCount === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 20px', borderRadius: 10, background: matchCount > 0 ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(99,102,241,0.12)', border: 'none', color: matchCount > 0 ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 800, cursor: matchCount > 0 ? 'pointer' : 'not-allowed', boxShadow: matchCount > 0 ? '0 6px 20px rgba(99,102,241,0.35)' : 'none', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                  >
                    <PackageOpen size={15} /> Download {matchCount > 0 ? `(${matchCount})` : ''}
                  </button>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

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
          <Image priority={true} src='/techbee-logo.png' alt='TechBee' width={38} height={38} style={{ objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(79,70,229,0.15))' }} />
          <div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Tech<span style={{ color: 'var(--color-brand)' }}>bee Chronicle</span></div>
            <div style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>HR Portal</div>
          </div>
        </div>

        {/* Navigation Menu Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '20px 12px', flex: 1 }}>
          {[
            { label: 'Dashboard', href: '/hr/dashboard', active: false, icon: <LayoutDashboard size={16} /> },
            { label: 'Schedule',  href: '/hr/schedule',  active: false, icon: <CalendarPlus size={16} /> },
            { label: 'Vault',     href: '/hr/vault',     active: false, icon: <HardDrive size={16} /> },
            { label: 'Reports',   href: '/hr/reports',   active: true,  icon: <FileText size={16} /> },
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
          <button
            onClick={handlePurgeAll}
            disabled={purging}
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 14px', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, transition: 'all 0.2s', fontWeight: 'bold' }}
            title="Delete all reports, recordings, and profiles across Vault, Reports, and Recordings"
          >
            <Trash2 size={14} />
            {purging ? 'Purging...' : 'Delete All Data'}
          </button>
          <button onClick={() => { fetchData(); }} style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 8, padding: '8px 14px', color: 'var(--color-brand)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 'bold', transition: 'all 0.2s' }}>
            <RefreshCw size={14} /> Sync Vault
          </button>
          <button
            onClick={() => setShowDownloadModal(true)}
            disabled={bulkDownloading}
            style={{ background: bulkDownloading ? 'rgba(79,70,229,0.08)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', cursor: bulkDownloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, opacity: bulkDownloading ? 0.6 : 1, fontWeight: 800, boxShadow: bulkDownloading ? 'none' : '0 4px 14px rgba(99,102,241,0.35)', transition: 'all 0.2s' }}
          >
            {bulkDownloading
              ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Downloading...</>
              : <><PackageOpen size={14} /> Download All ({allReports.filter(r => r.presign_url).length}) <SlidersHorizontal size={12} style={{ opacity: 0.7 }} /></>}
          </button>
        </div>

      <div style={{ padding: '24px 32px' }}>
        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 380 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input placeholder="Search by name, SAP ID, session..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '9px 12px 9px 36px', background: '#ffffff', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {(['All', 'Pass', 'Needs Review', 'Fail'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? 'rgba(79,70,229,0.08)' : '#ffffff', border: `1px solid ${filter === f ? 'rgba(79,70,229,0.2)' : 'rgba(79,70,229,0.1)'}`, borderRadius: 8, padding: '8px 16px', color: filter === f ? 'var(--color-brand)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: filter === f ? 700 : 500, transition: 'all 0.2s' }}>{f}</button>
          ))}

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: '#ffffff', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 10, padding: 3, gap: 2, marginLeft: 'auto' }}>
            <button onClick={() => handleSetViewMode('list')} style={{ background: viewMode === 'list' ? 'rgba(37,99,235,0.08)' : 'transparent', border: 'none', borderRadius: 8, padding: '6px 12px', color: viewMode === 'list' ? 'var(--color-brand)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: viewMode === 'list' ? 700 : 500, transition: 'all 0.2s' }}>
              <List size={14} /> List
            </button>
            <button onClick={() => handleSetViewMode('grid')} style={{ background: viewMode === 'grid' ? 'rgba(37,99,235,0.08)' : 'transparent', border: 'none', borderRadius: 8, padding: '6px 12px', color: viewMode === 'grid' ? 'var(--color-brand)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: viewMode === 'grid' ? 700 : 500, transition: 'all 0.2s' }}>
              <Grid size={14} /> Grid
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Reports',      value: allReports.length,                                    color: '#4f46e5' },
            { label: 'Unique Candidates',  value: candidates.length,                                    color: '#7c3aed' },
            { label: 'With Recordings',    value: candidates.filter(c => c.latest_video_url).length,    color: '#fb923c' },
            { label: 'Avg Size',           value: allReports.length ? `${Math.round(allReports.reduce((s, r) => s + r.size_kb, 0) / allReports.length)} KB` : '—', color: '#3b82f6' },
          ].map(stat => (
            <Card3D key={stat.label} intensity={8} shimmer={true} glowColor={`${stat.color}15`}>
              <div style={{ background: '#ffffff', border: `1px solid rgba(79,70,229,0.12)`, borderRadius: 14, padding: '16px 18px', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{stat.label}</div>
              </div>
            </Card3D>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}><RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12, marginInline: 'auto' }} /><p>Loading reports from Cloud Vault...</p></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}><FileText size={48} style={{ marginBottom: 12, opacity: 0.3, marginInline: 'auto' }} /><p style={{ fontSize: 16 }}>No reports found</p><p style={{ fontSize: 13 }}>Complete an interview to generate your first report</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '100%', gap: 16 }}>
            {filtered.map((r, idx) => {
              const score = getScore(r.sap_id);
              const status = getStatusFromScore(score);
              const noteKey = `${r.sap_id}_${r.session_id}`;
              const saved = getNote(noteKey);
              const isEditingThis = editingKey === noteKey;
              const videoUrl = (r as any).video_url || '';
              return (
                <Card3D key={r.s3_key || idx} intensity={5} shimmer={true} glowColor="rgba(79,70,229,0.12)">
                  <div style={{ background: '#ffffff', border: '1px solid rgba(79,70,229,0.12)', borderRadius: 14, padding: '20px 24px', boxSizing: 'border-box', height: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: viewMode === 'list' ? 'row' : 'column', alignItems: viewMode === 'list' ? 'flex-start' : 'stretch', gap: 16, height: '100%' }}>
                      
                      {/* Left icon and Details */}
                      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={20} color="#4f46e5" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }} className="text-left">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{r.candidate_name}</h3>
                            <span style={{ fontSize: 11, color: 'var(--color-brand)', background: 'rgba(79,70,229,0.08)', padding: '2px 8px', borderRadius: 20, fontWeight: 'bold' }}>{r.sap_id}</span>
                            <span style={{ fontSize: 11, color: '#16a34a', background: 'rgba(22,163,74,0.08)', padding: '2px 8px', borderRadius: 20, fontWeight: 'bold' }}>Module {r.bond_year || 1}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: status.color, background: status.bg, padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 'bold' }}>{status.icon} {status.label}</span>
                            {score && <span style={{ fontSize: 11, fontWeight: 700, color: status.color }}>{score}/100</span>}
                            {videoUrl && <span style={{ fontSize: 11, color: '#ea580c', background: 'rgba(251,146,60,0.08)', padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 'bold' }}><Video size={10} /> Recording</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> {r.timestamp_display}</span>
                            <span>Session: {r.session_id.substring(0, 8)}...</span>
                            {r.size_kb > 0 && <span>{r.size_kb} KB</span>}
                          </div>
                          {saved && !isEditingThis && (
                            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.15)', borderRadius: 8, fontSize: 12 }}>
                              <div style={{ color: '#b45309', fontWeight: 600, marginBottom: 2 }}>📝 HR Note · {saved.author} · {saved.timestamp}</div>
                              <div style={{ color: 'var(--text-primary)' }}>{saved.text}</div>
                            </div>
                          )}
                          {isEditingThis && (
                            <div style={{ marginTop: 10 }}>
                              <textarea autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add your HR notes..." style={{ width: '100%', minHeight: 80, padding: '10px 12px', background: '#ffffff', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
                              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                <button onClick={() => saveNote(noteKey, noteText)} style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: 6, padding: '6px 14px', color: '#16a34a', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Save size={12} /> Save Note</button>
                                <button onClick={() => { setEditingKey(null); setNoteText(''); }} style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, padding: '6px 12px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{
                        display: 'flex',
                        flexDirection: viewMode === 'list' ? 'column' : 'row',
                        gap: 8,
                        flexShrink: 0,
                        width: viewMode === 'list' ? 'auto' : '100%',
                        marginTop: viewMode === 'list' ? 0 : 12,
                        borderTop: viewMode === 'list' ? 'none' : '1px solid rgba(0,0,0,0.04)',
                        paddingTop: viewMode === 'list' ? 0 : 12,
                        flexWrap: 'wrap',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {videoUrl ? (
                            <button onClick={() => setVideoModal({ url: videoUrl, name: r.candidate_name })} style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 8, padding: '8px 12px', color: '#ea580c', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s', fontWeight: 'bold' }}>
                              <Play size={13} /> Recording
                            </button>
                          ) : (
                            <span style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 8, padding: '8px 12px', color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Video size={13} /> No Video</span>
                          )}
                          <button onClick={() => { setEditingKey(isEditingThis ? null : noteKey); setNoteText(saved?.text || ''); }} style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.15)', borderRadius: 8, padding: '8px 12px', color: '#b45309', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s', fontWeight: 'bold' }}>
                            <Edit3 size={13} /> Note
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {/* Detailed Report button */}
                          <button
                            onClick={() => router.push(`/hr/reports/${r.session_id}?name=${encodeURIComponent(r.candidate_name)}&sap=${r.sap_id}&pdf=${encodeURIComponent(r.presign_url || '')}&video=${encodeURIComponent(videoUrl || '')}`)}
                            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s', fontWeight: 800, boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
                          >
                            <BarChart3 size={13} /> Detailed Report
                          </button>
                          <button onClick={() => handleRegenerate(r.session_id, r.candidate_name, r.sap_id, videoUrl)} disabled={regeneratingId === r.session_id} style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-secondary)', cursor: regeneratingId === r.session_id ? 'not-allowed' : 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s' }} title="Regenerate Report">
                            {regeneratingId === r.session_id ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </Card3D>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>
    </div>
    </div>
  );
}
