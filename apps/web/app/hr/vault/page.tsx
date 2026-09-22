'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Search, RefreshCw, Video, Clapperboard, FileText, Download,
  ChevronDown, ChevronRight,
  ExternalLink, HardDrive, Award, Folder, FolderOpen,
  LayoutDashboard, Clock, HelpCircle, CalendarPlus, BookOpen} from 'lucide-react';
import Card3D from '@/components/Card3D';

// HexBackground3D is rendered globally in layout.tsx

interface VideoEntry {
  email: string;
  candidate_name: string;
  session_id: string;
  timestamp: string;
  timestamp_display: string;
  size_mb: number;
  presign_url: string;
  s3_key: string;
  bond_year?: number;
  sap_id?: string;
  module?: string;
  attempt_number?: number;
}

interface ReportEntry {
  email: string;
  candidate_name: string;
  session_id: string;
  timestamp: string;
  timestamp_display: string;
  size_kb: number;
  presign_url: string;
  s3_key: string;
  bond_year?: number;
  sap_id?: string;
  module?: string;
  attempt_number?: number;
}

interface S3Candidate {
  email: string;
  sap_id: string;
  candidate_name: string;
  videos: VideoEntry[];
  reports: ReportEntry[];
  latest_video_url: string | null;
  latest_video_ts: string | null;
  latest_report_url: string | null;
  total_size_mb: number;
  join_date?: string;
  current_bond_year?: number;
  current_module?: string;
}

interface LocalSession {
  candidate_name: string;
  candidate_email: string;
  candidate_sap_id?: string;
  s3_url: string;
  date: string;
  session_id: string;
  interviewed_at?: string;
  score?: number;
  bond_year?: number;
  current_bond_year?: number;
  join_date?: string;
}

export default function CandidatesPage() {
  const router = useRouter();

  const [candidates, setCandidates] = useState<S3Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);

  // S3 Directory Tree state
  const [expandedPaths, setExpandedPaths] = useState<string[]>(['root']);
  const [selectedFile, setSelectedFile] = useState<{
    type: 'profile' | 'video' | 'report';
    candidate: S3Candidate;
    data: any;
  } | null>(null);

  const togglePath = (path: string) => {
    setExpandedPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const fetchS3Data = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setSyncing(true);

    const buildLocalCandidate = (local: LocalSession & { pdf_url?: string; local_video_url?: string }): S3Candidate => {
      const playableVideoUrl = (local as any).local_video_url || local.s3_url || null;
      const email = local.candidate_email || 'unknown@fresher.in';
      const bond_year = local.bond_year || local.current_bond_year || 1;
      return ({
        email,
        sap_id: local.candidate_sap_id || (local as any).sap_id || '',
        candidate_name: local.candidate_name || 'Recent Candidate',
        join_date: local.join_date || '21 Aug 2026',
        current_bond_year: bond_year,
        current_module: `Module ${bond_year}`,
        total_size_mb: 0,
        latest_video_url: playableVideoUrl,
        latest_video_ts: local.date || 'Recent',
        latest_report_url: (local as any).pdf_url || null,
        videos: playableVideoUrl ? [{
          email,
          candidate_name: local.candidate_name,
          session_id: local.session_id,
          timestamp: '99999999_999999',
          timestamp_display: local.date || 'Just completed',
          size_mb: 0,
          presign_url: playableVideoUrl,
          bond_year: bond_year,
          s3_key: '',
        }] : [],
        reports: (local as any).pdf_url ? [{
          email,
          candidate_name: local.candidate_name,
          session_id: local.session_id,
          timestamp: '99999999_999999',
          timestamp_display: local.date || 'Just completed',
          size_kb: 0,
          presign_url: (local as any).pdf_url,
          bond_year: bond_year,
          s3_key: '',
        }] : [],
      });
    };

    try {
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetch('/api/s3-list', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        let s3Candidates: S3Candidate[] = data.candidates || [];

        const mergeLocalSessions = () => {
          const sessions: (LocalSession & { pdf_url?: string })[] = [];
          try {
            const raw = localStorage.getItem('latest_completed_interview_session');
            if (raw) sessions.push(JSON.parse(raw));
          } catch {}
          try {
            const histRaw = localStorage.getItem('interview_session_history');
            if (histRaw) {
              const hist = JSON.parse(histRaw);
              if (Array.isArray(hist)) sessions.push(...hist.slice(0, 10));
            }
          } catch {}
          return sessions;
        };

        const localSessions = mergeLocalSessions();
        for (const local of localSessions) {
          if (!local.candidate_email) continue;
          const existing = s3Candidates.find(c => c.email === local.candidate_email);
          if (!existing) {
            s3Candidates = [buildLocalCandidate(local), ...s3Candidates];
          } else {
            const localPdfUrl = (local as any).pdf_url;
            const localVideoUrl = local.s3_url;

            if (localPdfUrl) {
              const alreadyHasReport = existing.reports.some(r => 
                r.session_id === local.session_id || 
                local.session_id.startsWith(r.session_id) || 
                r.session_id.startsWith(local.session_id) ||
                (r.timestamp_display && local.date && (
                  r.timestamp_display.toLowerCase().replace(/[^a-z0-9]/g, '').includes(local.date.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
                  local.date.toLowerCase().replace(/[^a-z0-9]/g, '').includes(r.timestamp_display.toLowerCase().replace(/[^a-z0-9]/g, ''))
                ))
              );
              if (!alreadyHasReport) {
                if (!existing.latest_report_url) {
                  existing.latest_report_url = localPdfUrl;
                }
                existing.reports.unshift({
                  email: local.candidate_email,
                  candidate_name: local.candidate_name,
                  session_id: local.session_id,
                  timestamp: '99999999_999999',
                  timestamp_display: local.date || 'Latest',
                  size_kb: 0,
                  presign_url: localPdfUrl,
                  s3_key: '',
                });
              }
            }
            if (localVideoUrl) {
              const localVideoServeUrl = (local as any).local_video_url || localVideoUrl;
              const alreadyHasVideo = existing.videos.some(v => 
                v.session_id === local.session_id || 
                local.session_id.startsWith(v.session_id) || 
                v.session_id.startsWith(local.session_id) ||
                (v.timestamp_display && local.date && (
                  v.timestamp_display.toLowerCase().replace(/[^a-z0-9]/g, '').includes(local.date.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
                  local.date.toLowerCase().replace(/[^a-z0-9]/g, '').includes(v.timestamp_display.toLowerCase().replace(/[^a-z0-9]/g, ''))
                ))
              );
              if (!alreadyHasVideo) {
                if (!existing.latest_video_url) {
                  existing.latest_video_url = localVideoServeUrl;
                  existing.latest_video_ts = local.date || 'Latest';
                }
                existing.videos.unshift({
                  email: local.candidate_email,
                  candidate_name: local.candidate_name,
                  session_id: local.session_id,
                  timestamp: '99999999_999999',
                  timestamp_display: local.date || 'Latest',
                  size_mb: 0,
                  presign_url: localVideoServeUrl,
                  s3_key: '',
                });
              }
            }
          }
        }

        const seen = new Set<string>();
        s3Candidates = s3Candidates.filter(c => {
          if (seen.has(c.email)) return false;
          seen.add(c.email);
          return true;
        });

        setCandidates(s3Candidates);
        setLastSync(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));

        // Auto select first candidate's profile
        if (s3Candidates.length > 0 && !selectedFile) {
          setSelectedFile({
            type: 'profile',
            candidate: s3Candidates[0],
            data: s3Candidates[0]
          });
          setExpandedPaths(prev => {
            const p = `cand:${s3Candidates[0].email}`;
            return prev.includes(p) ? prev : [...prev, p];
          });
        }
      } else {
        throw new Error('S3 list API returned non-OK');
      }
    } catch (err) {
      console.warn('S3 sync failed, using localStorage fallback:', err);
      const sessions: (LocalSession & { pdf_url?: string })[] = [];
      try {
        const raw = localStorage.getItem('latest_completed_interview_session');
        if (raw) sessions.push(JSON.parse(raw));
      } catch {}
      try {
        const histRaw = localStorage.getItem('interview_session_history');
        if (histRaw) {
          const hist = JSON.parse(histRaw);
          if (Array.isArray(hist)) sessions.push(...hist.slice(0, 10));
        }
      } catch {}

      const seenEmail = new Set<string>();
      const localCandidates = sessions
        .filter(s => s.candidate_email && !seenEmail.has(s.candidate_email) && !!seenEmail.add(s.candidate_email))
        .map(buildLocalCandidate);
      setCandidates(localCandidates);
      if (localCandidates.length > 0 && !selectedFile) {
        setSelectedFile({
          type: 'profile',
          candidate: localCandidates[0],
          data: localCandidates[0]
        });
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [selectedFile]);

  useEffect(() => { fetchS3Data(); }, [fetchS3Data]);

  const filtered = candidates.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.candidate_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.sap_id && c.sap_id.toLowerCase().includes(q))
    );
  });

  const scoreFromAnalysis = () => {
    try {
      const a = localStorage.getItem('latest_interview_analysis');
      return a ? JSON.parse(a)?.overall_score || null : null;
    } catch { return null; }
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
            { label: 'Schedule',  href: '/hr/schedule',  active: false, icon: <CalendarPlus size={16} /> },
            { label: 'Vault',     href: '/hr/vault',     active: true,  icon: <HardDrive size={16} /> },
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
          {lastSync && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Last Sync: {lastSync}</span>
          )}
          <button
            onClick={() => fetchS3Data(true)}
            disabled={syncing}
            style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 8, padding: '8px 14px', color: 'var(--color-brand)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, transition: 'all 0.2s', fontWeight: 'bold' }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Syncing...' : 'Sync Vault'}
          </button>
        </div>

        {/* Title Bar */}
        <div style={{ padding: '24px 32px 0 32px' }} className="text-left">
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif', margin: 0 }}>Candidate Archive Vault</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>Techbee Chronicle Secure Repository · {candidates.length} Candidate Folders</p>
        </div>

        {/* Main Body with Split Pane */}
        <div style={{ display: 'flex', gap: 24, padding: '24px 32px', flex: 1, minHeight: 0 }}>
        
        {/* Left Column: S3 directory tree (glowing glass layout) */}
        <div style={{
          width: 400,
          background: '#ffffff',
          border: '1px solid rgba(79,70,229,0.12)',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search size={14} className="text-slate-400" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              placeholder="Search folders..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '9px 12px 9px 36px', background: '#ffffff', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div className="text-slate-500" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <HardDrive size={12} /> Candidate Asset Vault
          </div>

          {/* Collapsible S3 Folder Tree */}
          <div className="custom-tree-container" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {loading ? (
              <div className="text-slate-500" style={{ padding: '40px 0', textAlign: 'center' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8, marginInline: 'auto' }} />
                <div style={{ fontSize: 12 }}>Reading repository metadata...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-slate-500" style={{ padding: '40px 0', textAlign: 'center', fontSize: 12 }}>
                Empty vault / No matching paths
              </div>
            ) : (
              <div style={{ paddingLeft: 4 }}>
                {/* Root Directory Node */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, fontSize: 13, color: 'var(--color-brand)', cursor: 'pointer', background: 'rgba(79,70,229,0.06)' }}
                     onClick={() => togglePath('root')}>
                  {expandedPaths.includes('root') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <FolderOpen size={14} color="#4f46e5" />
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>candidate_vault/</span>
                </div>

                {/* Candidate Folder Children */}
                {expandedPaths.includes('root') && (
                  <div style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px dashed rgba(79,70,229,0.15)', marginLeft: 14 }}>
                    {filtered.map(cand => {
                      const candPath = `cand:${cand.email}`;
                      const isExpanded = expandedPaths.includes(candPath);
                      const isSelected = selectedFile?.candidate.email === cand.email;

                      return (
                        <div key={cand.email} style={{ display: 'flex', flexDirection: 'column' }}>
                          {/* Candidate Folder Node */}
                          <div
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, fontSize: 12,
                              color: isSelected ? 'var(--color-brand)' : 'var(--text-secondary)', cursor: 'pointer',
                              background: isSelected ? 'rgba(79,70,229,0.08)' : 'transparent',
                              transition: 'all 0.2s'
                            }}
                            onClick={() => {
                              togglePath(candPath);
                              setSelectedFile({ type: 'profile', candidate: cand, data: cand });
                            }}
                          >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {isExpanded ? <FolderOpen size={13} color="#4f46e5" /> : <Folder size={13} color="#4f46e5" />}
                            <span style={{ fontFamily: 'monospace', fontWeight: isSelected ? 700 : 500 }}>
                              {cand.candidate_name.replace(/\s+/g, '_')} {cand.sap_id ? `[SAP: ${cand.sap_id}]` : ''}/
                            </span>
                          </div>

                          {/* Candidate Folder Content */}
                          {isExpanded && (
                            <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px dashed rgba(79,70,229,0.12)', marginLeft: 14 }}>
                              
                              {/* profile.json file */}
                              <div
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, fontSize: 11,
                                  color: (selectedFile?.type === 'profile' && isSelected) ? 'var(--color-brand)' : 'var(--text-secondary)', cursor: 'pointer',
                                  background: (selectedFile?.type === 'profile' && isSelected) ? 'rgba(79,70,229,0.08)' : 'transparent'
                                }}
                                onClick={() => setSelectedFile({ type: 'profile', candidate: cand, data: cand })}
                              >
                                <ChevronRight size={12} style={{ opacity: 0 }} />
                                <FileText size={12} color="var(--text-secondary)" />
                                <span style={{ fontFamily: 'monospace' }}>profile.json</span>
                              </div>

                                  {cand.videos.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}
                                           onClick={() => togglePath(`${candPath}:videos`)}>
                                        {expandedPaths.includes(`${candPath}:videos`) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                        <Folder size={12} color="#fb923c" />
                                        <span style={{ fontFamily: 'monospace' }}>videos/</span>
                                      </div>
                                      {expandedPaths.includes(`${candPath}:videos`) && (
                                        <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px dashed rgba(79,70,229,0.12)', marginLeft: 12 }}>
                                          {cand.videos.map(vid => {
                                            const isThisVideo = selectedFile?.type === 'video' && selectedFile.data.session_id === vid.session_id;
                                            return (
                                              <div
                                                key={vid.session_id}
                                                style={{
                                                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, fontSize: 11,
                                                  color: isThisVideo ? '#fb923c' : 'var(--text-secondary)', cursor: 'pointer',
                                                  background: isThisVideo ? 'rgba(251,146,60,0.08)' : 'transparent'
                                                }}
                                                onClick={() => setSelectedFile({ type: 'video', candidate: cand, data: vid })}
                                              >
                                                <Video size={11} color={isThisVideo ? '#fb923c' : '#94a3b8'} />
                                                <span style={{ fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                  {vid.sap_id || cand.sap_id || 'SAP'}_{vid.module || `Module_${vid.bond_year || 1}`}_Attempt{vid.attempt_number || 1}_{vid.timestamp}_{vid.session_id ? vid.session_id.slice(0, 8) : 'sess'}.webm
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
    
                                  {/* reports/ folder */}
                                  {cand.reports.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}
                                           onClick={() => togglePath(`${candPath}:reports`)}>
                                        {expandedPaths.includes(`${candPath}:reports`) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                        <Folder size={12} color="#4f46e5" />
                                        <span style={{ fontFamily: 'monospace' }}>reports/</span>
                                      </div>
                                      {expandedPaths.includes(`${candPath}:reports`) && (
                                        <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px dashed rgba(79,70,229,0.12)', marginLeft: 12 }}>
                                          {cand.reports.map(rep => {
                                            const isThisReport = selectedFile?.type === 'report' && selectedFile.data.session_id === rep.session_id;
                                            return (
                                              <div
                                                key={rep.session_id}
                                                style={{
                                                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, fontSize: 11,
                                                  color: isThisReport ? 'var(--color-brand)' : 'var(--text-secondary)', cursor: 'pointer',
                                                  background: isThisReport ? 'rgba(79,70,229,0.08)' : 'transparent'
                                                }}
                                                onClick={() => setSelectedFile({ type: 'report', candidate: cand, data: rep })}
                                              >
                                                <FileText size={11} color={isThisReport ? 'var(--color-brand)' : '#94a3b8'} />
                                                <span style={{ fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                  {rep.sap_id || cand.sap_id || 'SAP'}_{rep.module || `Module_${rep.bond_year || 1}`}_Attempt{rep.attempt_number || 1}_{rep.timestamp}_{rep.session_id ? rep.session_id.slice(0, 8) : 'report'}.pdf
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}

                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 3D perspective details pane */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedFile ? (
            <Card3D intensity={selectedFile.type === 'video' ? 0 : 6} shimmer={selectedFile.type !== 'video'} glowColor="rgba(79,70,229,0.12)" style={{ height: '100%' }}>
              <div style={{
                height: '100%',
                background: '#ffffff',
                border: '1px solid rgba(79,70,229,0.15)',
                borderRadius: 20,
                padding: 30,
                boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                color: 'var(--text-primary)',
                boxSizing: 'border-box'
              }}>
                
                {/* Selected File Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(79,70,229,0.12)', paddingBottom: 16 }}>
                  <div>
                    <span className="text-slate-500" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                      Candidate Asset Inspector / {selectedFile.type}
                    </span>
                    <h2 style={{ margin: '4px 0 0 0', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
                      {selectedFile.candidate.candidate_name}
                    </h2>
                  </div>
                  {/* Status Indicator */}
                  <div style={{ fontSize: 11, color: 'var(--color-brand)', background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', padding: '4px 10px', borderRadius: 20 }}>
                    Secure Access Token Verified
                  </div>
                </div>

                {/* Details Body */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  
                  {/* PROFILE VIEW */}
                  {selectedFile.type === 'profile' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient-brand)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>
                          {selectedFile.candidate.candidate_name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedFile.candidate.candidate_name}</div>
                          <div className="text-slate-500" style={{ fontSize: 13, marginTop: 2 }}>{selectedFile.candidate.email}</div>
                          {selectedFile.candidate.sap_id && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 700 }}>🪪 SAP ID: {selectedFile.candidate.sap_id}</div>
                          )}
                          {selectedFile.candidate.join_date && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>📅 Date of Joining: {selectedFile.candidate.join_date}</div>
                          )}
                          <div style={{ fontSize: 12, color: 'var(--color-brand)', marginTop: 4, fontWeight: 700 }}>🛠️ Active Module: {selectedFile.candidate.current_module || 'Module 1'}</div>
                        </div>
                      </div>

                      {/* General Metadata */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 10 }}>
                        <div style={{ background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.08)', borderRadius: 12, padding: 14 }}>
                          <div className="text-slate-500" style={{ fontSize: 11 }}>Recorded Videos</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#fb923c', marginTop: 4 }}>{selectedFile.candidate.videos.length}</div>
                        </div>
                        <div style={{ background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.08)', borderRadius: 12, padding: 14 }}>
                          <div className="text-slate-500" style={{ fontSize: 11 }}>Evaluation Reports</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-brand)', marginTop: 4 }}>{selectedFile.candidate.reports.length}</div>
                        </div>
                        <div style={{ background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.08)', borderRadius: 12, padding: 14 }}>
                          <div className="text-slate-500" style={{ fontSize: 11 }}>Storage Used</div>
                          <div className="text-slate-700 font-bold" style={{ fontSize: 20, marginTop: 4 }}>{selectedFile.candidate.total_size_mb} MB</div>
                        </div>
                      </div>

                      {/* Evaluation Quick Summary */}
                      {selectedFile.candidate.videos.length > 0 && (
                        <div style={{ background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.12)', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 20, marginTop: 10 }}>
                          <div style={{ width: 50, height: 50, borderRadius: 10, background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Award size={24} color="var(--color-brand)" />
                          </div>
                          <div style={{ flex: 1 }} className="text-left">
                            <div className="text-slate-500" style={{ fontSize: 13 }}>Latest Completed Round Score</div>
                            <div className="text-slate-400" style={{ fontSize: 11, marginTop: 2 }}>Based on AI Proctoring & Response evaluations</div>
                          </div>
                          {scoreFromAnalysis() && (
                            <div style={{ textAlign: 'right' }}>
                              <span className="text-emerald-600 font-extrabold" style={{ fontSize: 28 }}>{scoreFromAnalysis()}</span>
                              <span className="text-slate-400" style={{ fontSize: 12 }}>/100</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* VIDEO PLAYER VIEW */}
                  {selectedFile.type === 'video' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Video Player wrapper with depth */}
                      <div style={{ background: '#000', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                        <video
                          key={selectedFile.data.session_id}
                          src={selectedFile.data.presign_url}
                          controls
                          autoPlay
                          style={{ width: '100%', display: 'block', maxHeight: '50vh' }}
                        />
                      </div>

                      {/* Video Info Table */}
                      <div style={{ background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.08)', borderRadius: 12, padding: 16, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-slate-500">Recording Timestamp</span>
                          <span className="text-slate-800" style={{ fontWeight: 600 }}>{selectedFile.data.timestamp_display}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: 6 }}>
                          <span className="text-slate-500">Session UUID</span>
                          <span className="text-slate-600" style={{ fontFamily: 'monospace' }}>{selectedFile.data.session_id}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: 6 }}>
                          <span className="text-slate-500">File Size</span>
                          <span className="text-slate-700">{selectedFile.data.size_mb} MB</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: 6 }}>
                          <span className="text-slate-500">Interview Module</span>
                          <span className="text-emerald-600 font-bold">Module {selectedFile.data.bond_year || 1}</span>
                        </div>
                      </div>

                      {/* Video Action Buttons */}
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <a href={selectedFile.data.presign_url} download style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 8, padding: '8px 14px', color: 'var(--color-brand)', cursor: 'pointer', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 'bold' }}>
                          <Download size={13} /> Download
                        </a>
                        <a href={selectedFile.data.presign_url} target="_blank" rel="noopener noreferrer" style={{ background: 'var(--gradient-brand)', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#ffffff', cursor: 'pointer', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', boxShadow: '0 4px 0 #3b1bb6, 0 4px 10px rgba(79,70,229,0.2)' }}>
                          <ExternalLink size={13} /> Open Secure Link
                        </a>
                      </div>
                    </div>
                  )}

                  {/* REPORT DETAILS VIEW */}
                  {selectedFile.type === 'report' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Overview Snapshot */}
                      <div style={{ background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.12)', borderRadius: 12, padding: 18, display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                          <FileText size={20} color="#4f46e5" />
                        </div>
                        <div style={{ flex: 1 }} className="text-left">
                          <div style={{ fontSize: 14, fontWeight: 700 }}>Evaluation PDF Report Ready</div>
                          <div className="text-slate-500" style={{ fontSize: 12, marginTop: 2 }}>{selectedFile.data.timestamp_display} · {selectedFile.data.size_kb} KB</div>
                        </div>
                      </div>

                      {/* PDF Report details list */}
                      <div style={{ background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.08)', borderRadius: 12, padding: 16, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-slate-500">Report File</span>
                          <span className="text-slate-800" style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedFile.data.timestamp}_report.pdf</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: 6 }}>
                          <span className="text-slate-500">Associated Session</span>
                          <span className="text-slate-600" style={{ fontFamily: 'monospace' }}>{selectedFile.data.session_id}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: 6 }}>
                          <span className="text-slate-500">Interview Module</span>
                          <span className="text-emerald-600 font-bold">Module {selectedFile.data.bond_year || 1}</span>
                        </div>
                      </div>

                      {/* Detailed Report action button */}
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                        <button
                          onClick={() => router.push(`/hr/reports/${selectedFile.data.session_id}?name=${encodeURIComponent(selectedFile.candidate.candidate_name)}&sap=${selectedFile.candidate.sap_id || ''}&pdf=${encodeURIComponent(selectedFile.data.presign_url || '')}&video=${encodeURIComponent(selectedFile.candidate.latest_video_url || '')}`)}
                          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8, padding: '9px 18px', color: '#ffffff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
                        >
                          <FileText size={14} /> Open Detailed Report
                        </button>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            </Card3D>
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(79,70,229,0.02)', border: '2px dashed rgba(79,70,229,0.15)', borderRadius: 20, color: 'var(--text-secondary)', gap: 10
            }}>
              <HardDrive size={32} style={{ opacity: 0.4 }} />
              <div style={{ fontSize: 13 }}>Select a file or folder from the Candidate Vault on the left to inspect assets.</div>
            </div>
          )}
        </div>

      </div>

    </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        
        /* Custom scrollbar styling for 3D look */
        .custom-tree-container::-webkit-scrollbar {
          width: 4px;
        }
        .custom-tree-container::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }
        .custom-tree-container::-webkit-scrollbar-thumb {
          background: rgba(42, 155, 173, 0.2);
          border-radius: 4px;
        }
        .custom-tree-container::-webkit-scrollbar-thumb:hover {
          background: rgba(245, 168, 0, 0.4);
        }
      `}</style>
    </div>
  );
}
