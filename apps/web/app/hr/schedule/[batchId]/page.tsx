'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, HardDrive, FileText, Clapperboard, HelpCircle,
  CalendarPlus, ArrowLeft, RefreshCw, CheckCircle2, Clock, Loader2,
  AlertCircle, PlayCircle, Mail, BookOpen, Search
} from 'lucide-react';

const API = (process.env.NEXT_PUBLIC_API_URL || 'https://techbee-api.onrender.com').replace(/\/+$/, '');

async function fetchAPI(endpoint: string, init?: RequestInit): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  try {
    const res = await fetch(cleanEndpoint, init);
    if (res.ok || (res.status < 500 && res.status !== 404)) {
      return res;
    }
    return await fetch(`${API}${cleanEndpoint}`, init);
  } catch (err) {
    try {
      return await fetch(`${API}${cleanEndpoint}`, init);
    } catch {
      throw err;
    }
  }
}

interface SessionRow {
  session_id: string;
  candidate_name: string;
  candidate_email: string;
  sap_id: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  email_sent_at: string | null;
  access_token: string | null;
}

interface BatchDetail {
  batch_id: string;
  batch_name: string;
  scheduled_at: string | null;
  expires_at: string | null;
  total: number;
  sessions: SessionRow[];
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   color: '#b45309', bg: '#fef3c7', icon: <Clock size={12} /> },
  active:    { label: 'Active',    color: '#1d4ed8', bg: '#dbeafe', icon: <PlayCircle size={12} /> },
  completed: { label: 'Completed', color: '#047857', bg: '#d1fae5', icon: <CheckCircle2 size={12} /> },
  abandoned: { label: 'No-show',   color: '#b91c1c', bg: '#fee2e2', icon: <AlertCircle size={12} /> },
  flagged:   { label: 'Flagged',   color: '#7c2d12', bg: '#ffedd5', icon: <AlertCircle size={12} /> },
};

const NAV = [
  { label: 'Dashboard', href: '/hr/dashboard', icon: <LayoutDashboard size={16} /> },
  { label: 'Schedule',  href: '/hr/schedule',  icon: <CalendarPlus size={16} /> },
  { label: 'Vault',     href: '/hr/vault',     icon: <HardDrive size={16} /> },
  { label: 'Reports',   href: '/hr/reports',   icon: <FileText size={16} /> },
  { label: 'Recordings', href: '/hr/recordings', icon: <Clapperboard size={16} /> },
  { label: 'Questions', href: '/hr/questions', icon: <HelpCircle size={16} /> },
  { label: 'Knowledge Base (RAG)', href: '/hr/knowledge', icon: <BookOpen size={16} /> },
];

function Sidebar({ active }: { active: string }) {
  const router = useRouter();
  return (
    <div style={{
      width: 260, background: 'var(--surface-1)',
      borderRight: '1px solid var(--surface-glass-border)',
      backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', zIndex: 50, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 20px', borderBottom: '1px solid var(--surface-glass-border)' }}>
        <Image src='/techbee-logo.png' alt='TechBee' width={38} height={38} style={{ objectFit: 'contain' }} />
        <div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>
            Tech<span style={{ color: 'var(--color-brand)' }}>bee Chronicle</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>HR Portal</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 12px', flex: 1 }}>
        {NAV.map(({ label, href, icon }) => {
          const isActive = active === label;
          return (
            <button key={label} onClick={() => router.push(href)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '10px 16px', borderRadius: 10, fontSize: 13,
              fontWeight: isActive ? 700 : 500, cursor: 'pointer',
              background: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
              border: 'none', borderLeft: isActive ? '3px solid var(--color-brand)' : '3px solid transparent',
              color: isActive ? 'var(--color-brand)' : 'var(--text-secondary)',
              textAlign: 'left', transition: 'all 0.15s',
            }}>
              {icon} {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.batchId as string;

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [resending, setResending] = useState(false);

  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('teams_token') || 'dev-token' : 'dev-token';

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetchAPI(`/api/hr/batches/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setBatch(await res.json());
    } catch (err) {
      console.error('Failed to load batch:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [batchId, token]);

  useEffect(() => { load(true); }, [load]);

  const handleResend = async () => {
    setResending(true);
    setResendStatus(null);
    try {
      // Use direct dispatch endpoint for immediate, verified delivery
      let res = await fetchAPI(`/api/hr/batches/${batchId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok && res.status === 404) {
        res = await fetchAPI(`/api/hr/batches/${batchId}/resend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({}),
        });
      }
      if (res.ok) {
        const data = await res.json();
        const count = data.processed_count || data.resent_count || 0;
        setResendStatus(`Invitations sent successfully to ${count} candidate(s)!`);
        setTimeout(() => setResendStatus(null), 5000);
      } else {
        setResendStatus('Failed to resend invitations.');
        setTimeout(() => setResendStatus(null), 5000);
      }
      load(false);
    } catch (e) {
      setResendStatus('Network error while resending.');
      setTimeout(() => setResendStatus(null), 5000);
    } finally { setResending(false); }
  };

  const filtered = (batch?.sessions || []).filter(s => {
    const matchSearch = s.candidate_name.toLowerCase().includes(search.toLowerCase()) ||
      s.candidate_email.toLowerCase().includes(search.toLowerCase()) ||
      (s.sap_id || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || s.status === filter;
    return matchSearch && matchFilter;
  });

  const stats = batch ? {
    total: batch.sessions.length,
    completed: batch.sessions.filter(s => s.status === 'completed').length,
    active: batch.sessions.filter(s => s.status === 'active').length,
    pending: batch.sessions.filter(s => s.status === 'pending').length,
    noshow: batch.sessions.filter(s => s.status === 'abandoned').length,
  } : null;

  const card: React.CSSProperties = {
    background: '#fff', border: '1.5px solid #c7d2e0',
    borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
  };

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif', display: 'flex' }}>
      <Sidebar active="Schedule" />

      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '100vh' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1.5px solid #dde3ed', padding: '20px 32px', position: 'sticky', top: 0, zIndex: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => router.push('/hr/schedule')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid #c7d2e0', background: '#fff', fontSize: 13, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
              <ArrowLeft size={14} /> Back
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e293b', fontFamily: 'Space Grotesk, sans-serif' }}>
                {batch?.batch_name || 'Batch Detail'}
              </h1>
              {batch?.scheduled_at && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                  Scheduled: {new Date(batch.scheduled_at).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid #c7d2e0', background: '#fff', fontSize: 12, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                <RefreshCw size={13} /> Refresh
              </button>
              <button onClick={handleResend} disabled={resending} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: resending ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', fontSize: 12, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                {resending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                Resend to Pending
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Status Alert Banner */}
          {resendStatus && (
            <div style={{
              padding: '12px 18px',
              borderRadius: 10,
              background: resendStatus.includes('successfully') ? '#ecfdf5' : '#fef2f2',
              border: `1.5px solid ${resendStatus.includes('successfully') ? '#10b981' : '#ef4444'}`,
              color: resendStatus.includes('successfully') ? '#047857' : '#b91c1c',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              {resendStatus.includes('successfully') ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {resendStatus}
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {[
                { label: 'Total',     value: stats.total,     color: '#6366f1', bg: '#eef2ff' },
                { label: 'Pending',   value: stats.pending,   color: '#f59e0b', bg: '#fffbeb' },
                { label: 'Active',    value: stats.active,    color: '#3b82f6', bg: '#eff6ff' },
                { label: 'Completed', value: stats.completed, color: '#10b981', bg: '#ecfdf5' },
                { label: 'No-shows',  value: stats.noshow,   color: '#ef4444', bg: '#fef2f2' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} style={{ ...card, padding: '16px 20px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color }}>{value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          {stats && stats.total > 0 && (
            <div style={{ ...card, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Overall Completion</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#6366f1' }}>{Math.round((stats.completed / stats.total) * 100)}%</span>
              </div>
              <div style={{ height: 10, borderRadius: 10, background: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 10, background: 'linear-gradient(90deg,#6366f1,#10b981)', width: `${(stats.completed / stats.total) * 100}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          )}

          {/* Table */}
          <div style={card}>
            {/* Filter bar */}
            <div style={{ padding: '14px 20px', borderBottom: '1.5px solid #e8edf3', background: '#f0f4f8', display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search candidates..."
                  style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1.5px solid #c7d2e0', fontSize: 13, color: '#1e293b', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              {['all', 'pending', 'active', 'completed', 'abandoned'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '7px 14px', borderRadius: 8, border: filter === f ? '2px solid #6366f1' : '1.5px solid #c7d2e0',
                  background: filter === f ? '#6366f1' : '#fff', color: filter === f ? '#fff' : '#475569',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                }}>
                  {f === 'all' ? 'All' : f === 'abandoned' ? 'No-show' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <Loader2 size={28} color="#6366f1" className="animate-spin" style={{ margin: '0 auto' }} />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #e8edf3' }}>
                      {['#', 'Candidate', 'SAP ID', 'Email', 'Status', 'Started', 'Completed', 'Email Sent', 'Action'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f8fafc', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, idx) => {
                      const cfg = STATUS_CFG[s.status] || STATUS_CFG.pending;
                      return (
                        <tr key={s.session_id} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                                {s.candidate_name.charAt(0)}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{s.candidate_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{s.sap_id || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>{s.candidate_email}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
                              {cfg.icon} {cfg.label}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }}>
                            {s.started_at ? new Date(s.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }}>
                            {s.ended_at ? new Date(s.ended_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 11, color: s.email_sent_at ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {s.email_sent_at ? 'Sent' : 'Pending'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {s.status === 'completed' && (
                              <button
                                onClick={() => router.push(`/hr/reports?session=${s.session_id}`)}
                                style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                View Report
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                          No candidates match your filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
