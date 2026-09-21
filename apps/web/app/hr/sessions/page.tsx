'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Search, Clock, CheckCircle, AlertTriangle,
  PlayCircle, ChevronRight, Users, LayoutDashboard, FileText,
  HardDrive, Video, Clapperboard, HelpCircle, BookOpen
} from 'lucide-react';
import Card3D from '@/components/Card3D';

// HexBackground3D is rendered globally in layout.tsx

interface Session {
  id: string;
  candidate_name: string;
  candidate_email: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  overall_score: number | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: '#b45309', bg: '#fef3c7', icon: <Clock className="w-3 h-3" /> },
  in_progress: { label: 'In Progress', color: '#1d4ed8', bg: '#dbeafe', icon: <PlayCircle className="w-3 h-3" /> },
  completed: { label: 'Completed', color: '#047857', bg: '#d1fae5', icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', color: '#b91c1c', bg: '#fee2e2', icon: <AlertTriangle className="w-3 h-3" /> },
};

const MOCK_SESSIONS: Session[] = [
  { id: 'sess-001', candidate_name: 'Priya Sharma', candidate_email: 'priya.sharma@techbee.com', status: 'completed', scheduled_at: '2024-01-15T10:00:00Z', started_at: '2024-01-15T10:02:00Z', ended_at: '2024-01-15T10:28:00Z', duration_seconds: 1560, overall_score: 82 },
  { id: 'sess-002', candidate_name: 'Arjun Reddy', candidate_email: 'arjun.reddy@techbee.com', status: 'completed', scheduled_at: '2024-01-15T11:00:00Z', started_at: '2024-01-15T11:03:00Z', ended_at: '2024-01-15T11:25:00Z', duration_seconds: 1320, overall_score: 91 },
  { id: 'sess-003', candidate_name: 'Kavitha Nair', candidate_email: 'kavitha.nair@techbee.com', status: 'in_progress', scheduled_at: '2024-01-16T09:30:00Z', started_at: '2024-01-16T09:32:00Z', ended_at: null, duration_seconds: null, overall_score: null },
  { id: 'sess-004', candidate_name: 'Rahul Kumar', candidate_email: 'rahul.kumar@techbee.com', status: 'pending', scheduled_at: '2024-01-16T14:00:00Z', started_at: null, ended_at: null, duration_seconds: null, overall_score: null },
  { id: 'sess-005', candidate_name: 'Deepa Venkatesh', candidate_email: 'deepa.v@techbee.com', status: 'pending', scheduled_at: '2024-01-17T10:00:00Z', started_at: null, ended_at: null, duration_seconds: null, overall_score: null },
  { id: 'sess-006', candidate_name: 'Siddharth Patel', candidate_email: 'sid.patel@techbee.com', status: 'cancelled', scheduled_at: '2024-01-14T10:00:00Z', started_at: null, ended_at: null, duration_seconds: null, overall_score: null },
];

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const handleViewReport = async (sessionId: string) => {
    try {
      const token = sessionStorage.getItem('teams_token') || 'dev-token';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/hr/report/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const pdfUrl = data.pdf_url || `${apiUrl}/api/reports/serve/${sessionId}?token=${token}`;
        window.open(pdfUrl, '_blank');
      } else {
        const pdfUrl = `${apiUrl}/api/reports/serve/${sessionId}?token=${token}`;
        window.open(pdfUrl, '_blank');
      }
    } catch (e) {
      console.error('Failed to view report:', e);
      const token = sessionStorage.getItem('teams_token') || 'dev-token';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const pdfUrl = `${apiUrl}/api/reports/serve/${sessionId}?token=${token}`;
      window.open(pdfUrl, '_blank');
    }
  };

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const token = sessionStorage.getItem('teams_token') || 'dev-token';
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/interview/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setSessions(await res.json());
        } else {
          setSessions(MOCK_SESSIONS);
        }
      } catch {
        setSessions(MOCK_SESSIONS);
      }
    };
    loadSessions();
  }, []);

  const filtered = sessions.filter(s => {
    const matchesSearch = (s.candidate_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.candidate_email || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === 'all' || s.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const getScoreClass = (score: number | null) => {
    if (score === null) return '';
    if (score >= 80) return 'text-green-400 font-bold';
    if (score >= 60) return 'text-amber-400 font-bold';
    return 'text-red-400 font-bold';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)',
      display: 'flex', flexDirection: 'row', position: 'relative', overflow: 'hidden' }}>
      {/* HexBackground3D is global */}

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
            { label: 'Dashboard', href: '/hr/dashboard', active: false, icon: <LayoutDashboard size={16} /> },
            { label: 'Sessions',  href: '/hr/sessions',  active: true,  icon: <Clock size={16} /> },
            { label: 'Vault',     href: '/hr/vault',     active: false, icon: <HardDrive size={16} /> },
            { label: 'Reports',   href: '/hr/reports',   active: false, icon: <FileText size={16} /> },
            { label: 'Recordings',    href: '/hr/recordings',    active: false, icon: <Clapperboard size={16} /> },
            { label: 'Questions', href: '/hr/questions', active: false, icon: <HelpCircle size={16} /> },
            { label: 'Knowledge Base (RAG)', href: '/hr/knowledge', active: false, icon: <BookOpen size={16} /> },
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

      <div className="max-w-7xl mx-auto p-8 animate-fade-in">
        {/* Filters + Search */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by candidate name or email..."
              style={{ width: '100%', padding: '10px 12px 10px 38px', background: '#ffffff', border: '1px solid rgba(79,70,229,0.15)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'in_progress', label: 'In Progress' },
              { key: 'completed', label: 'Completed' },
            ].map(f => (
              <button key={f.key}
                onClick={() => setActiveFilter(f.key)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid rgba(79,70,229,0.1)',
                  background: activeFilter === f.key ? 'rgba(79,70,229,0.08)' : '#ffffff',
                  color: activeFilter === f.key ? 'var(--color-brand)' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions Grid */}
        <div style={{ background: '#ffffff', border: '1px solid rgba(79,70,229,0.12)', borderRadius: '16px', padding: 20 }}>
          <div className="flex items-center gap-2 mb-6"
            style={{ borderBottom: '1px solid rgba(79,70,229,0.08)', paddingBottom: 12 }}>
            <Users className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-slate-800">Sessions List ({filtered.length})</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500">No sessions found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filtered.map((session, i) => {
                const status = statusConfig[session.status];
                return (
                  <Card3D key={session.id} intensity={4} shimmer={true} glowColor={`${status.color}18`}>
                    <div
                      className="px-6 py-4 flex items-center gap-4 transition-all"
                      style={{ background: '#ffffff', border: '1px solid rgba(79,70,229,0.1)', borderRadius: 12, height: '100%', boxSizing: 'border-box' }}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold animate-pulse-subtle"
                        style={{ background: 'rgba(79,70,229,0.08)', color: 'var(--color-brand)' }}>
                        {session.candidate_name ? session.candidate_name.split(' ').map(n => n[0]).join('') : '??'}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold truncate text-slate-800">{session.candidate_name}</p>
                        <p className="text-xs truncate text-slate-500">{session.candidate_email}</p>
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: status.bg, color: status.color, border: `1px solid ${status.color}25` }}>
                        {status.icon}
                        {status.label}
                      </div>

                      {/* Scheduled */}
                      <div className="text-right w-36">
                        <p className="text-xs text-slate-500">
                          {formatDate(session.scheduled_at)}
                        </p>
                      </div>

                      {/* Duration */}
                      <div className="text-right w-16">
                        <p className="text-xs font-mono text-slate-500">
                          {formatDuration(session.duration_seconds)}
                        </p>
                      </div>

                      {/* Score */}
                      <div className="w-16 text-right">
                        {session.overall_score !== null ? (
                          <span className={`text-sm ${getScoreClass(session.overall_score)}`}>
                            {session.overall_score}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>

                      {/* Action */}
                      <button
                        onClick={() => {
                          if (session.status === 'completed') {
                            handleViewReport(session.id);
                          }
                        }}
                        disabled={session.status !== 'completed'}
                        className="push-button-3d"
                        style={{
                          background: session.status === 'completed' ? 'var(--gradient-brand)' : 'rgba(0,0,0,0.03)',
                          color: session.status === 'completed' ? '#FFFFFF' : '#94a3b8',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 14px',
                          fontSize: '12px',
                          cursor: session.status === 'completed' ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 'bold',
                          boxShadow: session.status === 'completed' ? '0 4px 0 #3b1bb6, 0 4px 10px rgba(79,70,229,0.2)' : 'none',
                          transform: 'translateY(0)',
                          transition: 'all 0.1s ease',
                        }}
                      >
                        View Report <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </Card3D>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        
        /* 3D push down animation for buttons */
        .push-button-3d:active:not(:disabled) {
          transform: translateY(3px) !important;
          box-shadow: 0 1px 0 #124c56, 0 2px 4px rgba(0,0,0,0.4) !important;
        }
      `}</style>
    </div>
  );
}
