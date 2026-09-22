'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Play, Download, Video, Clapperboard, Search, Calendar,
  RefreshCw, X, Film, LayoutDashboard, Clock, HardDrive, FileText, HelpCircle,
  List, Grid, CalendarPlus, BookOpen, Trash2} from 'lucide-react';
import Card3D from '@/components/Card3D';

interface S3Video {
  email: string;
  candidate_name: string;
  session_id: string;
  timestamp: string;
  timestamp_display: string;
  size_mb: number;
  presign_url: string;
  bond_year: number;
  s3_key: string;
}

interface S3Candidate {
  email: string;
  sap_id: string;
  candidate_name: string;
  join_date?: string;
  current_bond_year?: number;
  current_module?: string;
  videos: S3Video[];
  reports: any[];
  latest_video_url: string | null;
  latest_video_ts: string | null;
  latest_report_url: string | null;
  total_size_mb: number;
}

interface LocalSession {
  candidate_email: string;
  candidate_name: string;
  session_id: string;
  s3_url?: string;
  local_video_url?: string;
  date?: string;
  join_date?: string;
  bond_year?: number;
  current_bond_year?: number;
  candidate_sap_id?: string;
}

type FilterModuleType = 'All' | 'Module 1' | 'Module 2' | 'Module 3' | 'Module 4' | 'Module 5' | 'Module 6';

function VideoModal({ url, name, moduleName, onClose }: { url: string; name: string; moduleName: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#ffffff', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 900, boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={16} color='#ea580c' />
            </div>
            <div className="text-left">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Interview Recording ({moduleName})</h2>
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

export default function VideosPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<S3Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState<FilterModuleType>('All');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<{ url: string; name: string; moduleName: string } | null>(null);
  const [purging, setPurging] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

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

  useEffect(() => {
    const saved = localStorage.getItem('view_mode_videos') as 'list' | 'grid';
    if (saved) setViewMode(saved);
  }, []);

  const handleSetViewMode = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('view_mode_videos', mode);
  };

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
      reports: [],
    });
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setSyncing(true);
    const localSessions: (LocalSession & { pdf_url?: string })[] = [];
    try {
      const raw = localStorage.getItem('latest_completed_interview_session');
      if (raw) localSessions.push(JSON.parse(raw));
    } catch {}
    try {
      const h = localStorage.getItem('interview_session_history');
      if (h) {
        const hist = JSON.parse(h);
        if (Array.isArray(hist)) localSessions.push(...hist.slice(0, 20));
      }
    } catch {}

    try {
      const token = sessionStorage.getItem("teams_token") || "dev-token";
      const res = await fetch('/api/s3-list', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        let merged: S3Candidate[] = data.candidates || [];
        
        for (const local of localSessions) {
          if (!local.candidate_email) continue;
          const exists = merged.find(c => c.email === local.candidate_email);
          if (!exists) {
            merged.push(buildLocalCandidate(local));
          } else {
            const localVideoUrl = (local as any).local_video_url || local.s3_url;
            if (localVideoUrl) {
              const alreadyHasVideo = exists.videos.some(v => 
                v.session_id === local.session_id || 
                local.session_id.startsWith(v.session_id) || 
                v.session_id.startsWith(local.session_id) ||
                (v.timestamp_display && local.date && (
                  v.timestamp_display.toLowerCase().replace(/[^a-z0-9]/g, '').includes(local.date.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
                  local.date.toLowerCase().replace(/[^a-z0-9]/g, '').includes(v.timestamp_display.toLowerCase().replace(/[^a-z0-9]/g, ''))
                ))
              );
              if (!alreadyHasVideo) {
                if (!exists.latest_video_url) {
                  exists.latest_video_url = localVideoUrl;
                }
                const bond_year = local.bond_year || local.current_bond_year || 1;
                exists.videos.unshift({
                  email: local.candidate_email,
                  candidate_name: local.candidate_name,
                  session_id: local.session_id,
                  timestamp: '99999999_999999',
                  timestamp_display: local.date || 'Just completed',
                  size_mb: 0,
                  presign_url: localVideoUrl,
                  bond_year: bond_year,
                  s3_key: '',
                });
              }
            }
          }
        }
        
        const seen = new Set<string>();
        merged = merged.filter(c => {
          if (seen.has(c.email)) return false;
          seen.add(c.email);
          return true;
        });

        setCandidates(merged);
        setLastSync(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      } else throw new Error('non-ok');
    } catch {
      setCandidates(localSessions.map(buildLocalCandidate));
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allVideos = useMemo(() => {
    return candidates.flatMap(c =>
      c.videos.map(v => ({
        ...v,
        candidate_name: c.candidate_name,
        sap_id: c.sap_id || 'N/A',
        join_date: c.join_date || 'N/A'
      }))
    ).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [candidates]);

  const filtered = useMemo(() => {
    return allVideos.filter(v => {
      const matchSearch =
        v.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.sap_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.session_id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (filterModule === 'All') return true;
      return `Module ${v.bond_year || 1}` === filterModule;
    });
  }, [allVideos, searchQuery, filterModule]);

  const totalStorage = useMemo(() => {
    return candidates.reduce((s, c) => s + c.total_size_mb, 0).toFixed(1);
  }, [candidates]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)',
      display: 'flex', flexDirection: 'row', position: 'relative', overflow: 'hidden' }}>
      {/* HexBackground3D is global */}
      {videoModal && <VideoModal url={videoModal.url} name={videoModal.name} moduleName={videoModal.moduleName} onClose={() => setVideoModal(null)} />}

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
            { label: 'Vault',     href: '/hr/vault',     active: false, icon: <HardDrive size={16} /> },
            { label: 'Reports',   href: '/hr/reports',   active: false, icon: <FileText size={16} /> },
            { label: 'Recordings',    href: '/hr/recordings', active: true,  icon: <Clapperboard size={16} /> },
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
            onClick={handlePurgeAll}
            disabled={purging}
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 14px', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, transition: 'all 0.2s', fontWeight: 'bold' }}
            title="Delete all reports, recordings, and profiles across Vault, Reports, and Recordings"
          >
            <Trash2 size={14} />
            {purging ? 'Purging...' : 'Delete All Data'}
          </button>
          <button onClick={() => fetchData(true)} disabled={syncing} style={{ background: 'var(--gradient-brand)', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 'bold', boxShadow: '0 4px 0 #3b1bb6, 0 4px 10px rgba(79,70,229,0.2)' }}>
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} /> {syncing ? 'Syncing...' : 'Sync Vault'}
          </button>
        </div>

      <div style={{ padding: '24px 32px' }}>
        {/* Title Bar */}
        <div style={{ marginBottom: 24 }} className="text-left">
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif', margin: 0 }}>Candidate Video Recordings</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>Techbee Chronicle Secure Vault · Access candidate session screen & audio records</p>
        </div>

        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 380 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input placeholder="Search by candidate name, SAP ID, session..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '9px 12px 9px 36px', background: '#ffffff', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {(['All', 'Module 1', 'Module 2', 'Module 3', 'Module 4', 'Module 5', 'Module 6'] as FilterModuleType[]).map(m => (
            <button key={m} onClick={() => setFilterModule(m)} style={{ background: filterModule === m ? 'rgba(79,70,229,0.08)' : '#ffffff', border: `1px solid ${filterModule === m ? 'rgba(79,70,229,0.2)' : 'rgba(79,70,229,0.1)'}`, borderRadius: 8, padding: '8px 16px', color: filterModule === m ? 'var(--color-brand)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: filterModule === m ? 700 : 500, transition: 'all 0.2s' }}>{m}</button>
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

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Recorded Videos', value: allVideos.length, color: '#fb923c' },
            { label: 'Unique Candidates',    value: candidates.length, color: '#7c3aed' },
            { label: 'Total Storage Used',   value: `${totalStorage} MB`, color: '#2563eb' },
            { label: 'Avg File Size',        value: allVideos.length ? `${(allVideos.reduce((sum, v) => sum + v.size_mb, 0) / allVideos.length).toFixed(1)} MB` : '—', color: '#16a34a' },
          ].map(stat => (
            <Card3D key={stat.label} intensity={8} shimmer={true} glowColor={`${stat.color}15`}>
              <div style={{ background: '#ffffff', border: `1px solid rgba(79,70,229,0.12)`, borderRadius: 14, padding: '16px 18px', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{stat.label}</div>
              </div>
            </Card3D>
          ))}
        </div>

        {/* Grid List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}><RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12, marginInline: 'auto' }} /><p>Loading videos from Cloud Vault...</p></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}><Video size={48} style={{ marginBottom: 12, opacity: 0.3, marginInline: 'auto' }} /><p style={{ fontSize: 16 }}>No videos found</p><p style={{ fontSize: 13 }}>Complete an interview session to capture and list a video</p></div>
        ) : viewMode === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((v, idx) => {
              const moduleLabel = `Module ${v.bond_year || 1}`;
              return (
                <Card3D key={v.s3_key || idx} intensity={3} shimmer={true} glowColor="rgba(251,146,60,0.06)">
                  <div style={{ background: '#ffffff', border: '1px solid rgba(251,146,60,0.12)', borderRadius: 14, padding: '16px 20px', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      
                      {/* Film icon */}
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Film size={18} color="#ea580c" />
                      </div>
                      
                      {/* Name & ID */}
                      <div style={{ flex: 2, minWidth: 160 }} className="text-left">
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{v.candidate_name}</h3>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--color-brand)', background: 'rgba(37,99,235,0.08)', padding: '1px 6px', borderRadius: 4, fontWeight: 'bold' }}>SAP ID: {v.sap_id}</span>
                          <span style={{ fontSize: 10, color: '#16a34a', background: 'rgba(22,163,74,0.08)', padding: '1px 6px', borderRadius: 4, fontWeight: 'bold' }}>{moduleLabel}</span>
                        </div>
                      </div>
                      
                      {/* Date and Time */}
                      <div style={{ flex: 1.5, minWidth: 150, fontSize: 12, color: 'var(--text-secondary)' }} className="text-left">
                        <div style={{ fontWeight: 600, color: '#64748b', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Date & Time</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> {v.timestamp_display}</div>
                      </div>
                      
                      {/* Session ID */}
                      <div style={{ flex: 1.5, minWidth: 120, fontSize: 12, color: 'var(--text-secondary)' }} className="text-left">
                        <div style={{ fontWeight: 600, color: '#64748b', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Session ID</div>
                        <span style={{ fontFamily: 'monospace' }}>{v.session_id.substring(0, 12)}</span>
                      </div>
                      
                      {/* File Size */}
                      <div style={{ flex: 1, minWidth: 80, fontSize: 12, color: 'var(--text-secondary)' }} className="text-left">
                        <div style={{ fontWeight: 600, color: '#64748b', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>File Size</div>
                        <span style={{ fontWeight: 500 }}>{v.size_mb > 0 ? `${v.size_mb} MB` : 'Mock'}</span>
                      </div>
                      
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
                        <button
                          onClick={() => setVideoModal({ url: v.presign_url, name: v.candidate_name, moduleName: moduleLabel })}
                          style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 8, padding: '8px 14px', color: '#ea580c', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', transition: 'all 0.2s' }}
                        >
                          <Play size={12} /> Play
                        </button>
                        <a
                          href={v.presign_url}
                          download={`Video_${v.candidate_name.replace(/\s+/g, '_')}_${v.session_id}.webm`}
                          style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 8, padding: '8px 12px', color: 'var(--color-brand)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontWeight: 'bold', transition: 'all 0.2s' }}
                        >
                          <Download size={13} />
                        </a>
                      </div>
                    </div>
                  </div>
                </Card3D>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {filtered.map((v, idx) => {
              const moduleLabel = `Module ${v.bond_year || 1}`;
              return (
                <Card3D key={v.s3_key || idx} intensity={6} shimmer={true} glowColor="rgba(251,146,60,0.12)">
                  <div style={{ background: '#ffffff', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 16, padding: 20, boxSizing: 'border-box', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Film size={20} color="#ea580c" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }} className="text-left">
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{v.candidate_name}</h3>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--color-brand)', background: 'rgba(37,99,235,0.08)', padding: '1px 6px', borderRadius: 4, fontWeight: 'bold' }}>SAP ID: {v.sap_id}</span>
                          <span style={{ fontSize: 10, color: '#16a34a', background: 'rgba(22,163,74,0.08)', padding: '1px 6px', borderRadius: 4, fontWeight: 'bold' }}>{moduleLabel}</span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Details */}
                    <div style={{ background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.08)', borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }} className="text-left">
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> Date & Time</span>
                        <span className="text-slate-700 font-medium">{v.timestamp_display}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.02)', paddingTop: 4 }}>
                        <span>Session ID</span>
                        <span className="font-mono text-slate-500">{v.session_id.substring(0, 12)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.02)', paddingTop: 4 }}>
                        <span>File Size</span>
                        <span className="font-medium">{v.size_mb > 0 ? `${v.size_mb} MB` : 'Mock'}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                      <button
                        onClick={() => setVideoModal({ url: v.presign_url, name: v.candidate_name, moduleName: moduleLabel })}
                        style={{ flex: 1, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 8, padding: '8px 12px', color: '#ea580c', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 'bold', transition: 'all 0.2s' }}
                      >
                        <Play size={12} /> Watch Video
                      </button>
                      <a
                        href={v.presign_url}
                        download={`Video_${v.candidate_name.replace(/\s+/g, '_')}_${v.session_id}.webm`}
                        style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 8, padding: '8px 12px', color: 'var(--color-brand)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontWeight: 'bold', transition: 'all 0.2s' }}
                      >
                        <Download size={13} />
                      </a>
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
