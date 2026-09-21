'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, HardDrive, FileText, Video, Clapperboard, HelpCircle,
  CalendarPlus, Upload, X, Check, Users, Clock, Zap,
  Calendar, AlertTriangle, CheckCircle2, Loader2, Mail,
  RefreshCw, Eye, Timer, Layers, Info, Search, AlignJustify,
  ShieldCheck, UserX, Settings, Trash2, Plus, BookOpen
} from 'lucide-react';

const API = (process.env.NEXT_PUBLIC_API_URL || 'https://techbee-api.onrender.com').replace(/\/+$/, '');

// Resilient fetch helper: tries direct API URL, falls back to Next.js proxy rewrite
async function fetchAPI(endpoint: string, init?: RequestInit): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  try {
    const res = await fetch(`${API}${cleanEndpoint}`, init);
    if (res.ok || res.status < 500) {
      return res;
    }
    return await fetch(cleanEndpoint, init);
  } catch (err) {
    try {
      return await fetch(cleanEndpoint, init);
    } catch {
      throw err;
    }
  }
}


// ── Types ────────────────────────────────────────────────────────────────────

interface ResolvedCandidate {
  id: string;
  name: string;
  email: string;
  sap_id: string;
  is_active: boolean;
  current_module: number;
  module_label: string;
  join_date: string | null;
  module_override?: number;
}

interface ManualCandidate {
  id: string;
  name: string;
  email: string;
  sap_id: string;
  doj: string;
  module_override: number | 'auto';
}

interface Batch {
  batch_id: string;
  batch_name: string;
  scheduled_at: string | null;
  expires_at: string | null;
  total: number;
  pending: number;
  completed: number;
  active: number;
  abandoned: number;
}

type TimeMode = 'exact' | 'window' | 'staggered';
type ModuleMode = 'auto' | 'override';

const MODULE_LEVELS = [
  { year: 1, label: 'Module 1', sublabel: 'Baseline: General intro & traits', badge: 'Baseline', color: '#10b981' },
  { year: 2, label: 'Module 2', sublabel: 'Early Progress evaluation', badge: 'Early', color: '#6366f1' },
  { year: 3, label: 'Module 3', sublabel: 'Competency & mindset audit', badge: 'Audit', color: '#f59e0b' },
  { year: 4, label: 'Module 4', sublabel: 'Advanced cognitive testing', badge: 'Advanced', color: '#0ea5e9' },
  { year: 5, label: 'Module 5', sublabel: 'Leadership potential & strategic thinking', badge: 'Leadership', color: '#8b5cf6' },
  { year: 6, label: 'Module 6', sublabel: 'Senior maturity & domain mastery', badge: 'Senior', color: '#ef4444' },
  { year: 7, label: 'Module 7', sublabel: 'Crisis management & endurance', badge: 'Crisis', color: '#eab308' },
  { year: 8, label: 'Module 8', sublabel: 'Executive vision & ethics', badge: 'Executive', color: '#14b8a6' },
  { year: 9, label: 'Module 9', sublabel: 'Elite assessment - Retention forecast', badge: 'Elite', color: '#f43f5e' },
  { year: 10, label: 'Module 10', sublabel: 'Masterclass: Board-level decision making', badge: 'Master', color: '#3b82f6' },
];



const NAV = [
  { label: 'Dashboard', href: '/hr/dashboard', icon: <LayoutDashboard size={16} /> },
  { label: 'Schedule',  href: '/hr/schedule',  icon: <CalendarPlus size={16} /> },
  { label: 'Vault',     href: '/hr/vault',     icon: <HardDrive size={16} /> },
  { label: 'Reports',   href: '/hr/reports',   icon: <FileText size={16} /> },
  { label: 'Recordings',    href: '/hr/recordings',    icon: <Clapperboard size={16} /> },
  { label: 'Questions', href: '/hr/questions', icon: <HelpCircle size={16} /> },
  { label: 'Knowledge Base (RAG)', href: '/hr/knowledge', icon: <BookOpen size={16} /> },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

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
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--surface-glass-border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center' }}>techbeechronical@hcltech.com</div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const router = useRouter();

  // ── Form State ──────────────────────────────────────────────────────────────
  const [batchName,    setBatchName]    = useState('');
  const [moduleMode,   setModuleMode]   = useState<ModuleMode>('auto');
  const [moduleOverride, setModuleOverride] = useState(1);
  const [date,         setDate]         = useState('');
  const [time,         setTime]         = useState('10:00');
  const [timeMode,     setTimeMode]     = useState<TimeMode>('window');
  const [windowHours,  setWindowHours]  = useState(8);
  const [staggerMins,  setStaggerMins]  = useState(30);
  const [staggerGroup, setStaggerGroup] = useState(20);


  // ── Candidate State ─────────────────────────────────────────────────────────
  const [manualCandidates, setManualCandidates] = useState<ManualCandidate[]>([{ id: '1', name: '', email: '', sap_id: '', doj: '', module_override: 'auto' }]);
  const [resolved,     setResolved]     = useState<ResolvedCandidate[]>([]);
  const [unresolved,   setUnresolved]   = useState<string[]>([]);
  const [resolving,    setResolving]    = useState(false);
  const [inputMode,    setInputMode]    = useState<'manual' | 'upload'>('manual');
  const [csvError, setCsvError] = useState('');
  const [resolveError, setResolveError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Batch State ─────────────────────────────────────────────────────────────
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState('');
  const [createdBatch, setCreatedBatch] = useState<{ batch_id: string; total: number; unresolved: string[] } | null>(null);
  const [batches,      setBatches]      = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const getToken = () => typeof window !== 'undefined' ? sessionStorage.getItem('teams_token') || 'dev-token' : 'dev-token';

  // ── Load batches ────────────────────────────────────────────────────────────
  const [batchLoadError, setBatchLoadError] = useState('');
  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    setBatchLoadError('');
    try {
      const res = await fetchAPI('/api/hr/batches', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const d = await res.json(); setBatches(d.batches || []); }
      else { setBatchLoadError(`Failed to load batches (${res.status})`); }
    } catch { setBatchLoadError('Cannot connect to API server.'); }
    finally { setLoadingBatches(false); }
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  // ── Resolve candidates ──────────────────────────────────────────────────────
  const handleResolve = async () => {
    setResolveError('');
    
    const valid = manualCandidates.filter(c => c.email && c.email.includes('@'));
    if (!valid.length) {
      setResolveError('No valid email addresses provided in the table.');
      return;
    }
    
    setResolving(true);
    setResolved([]);
    setUnresolved([]);
    try {
      const entries = valid.map(c => ({
        name: c.name,
        email: c.email,
        sap_id: c.sap_id,
        doj: c.doj,
      }));
      const res = await fetchAPI('/api/hr/batches/register-and-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ candidates: entries }),
      });
      if (res.ok) {
        const data = await res.json();
        // Restore manual overrides from the manual candidates table
        const resolvedWithOverrides = (data.resolved || []).map((r: any) => {
           const match = valid.find(v => v.email.toLowerCase() === r.email.toLowerCase());
           return { ...r, module_override: match && match.module_override !== 'auto' ? match.module_override : undefined };
        });
        setResolved(resolvedWithOverrides);
        setUnresolved(data.errors || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setResolveError(err.detail?.error || err.detail || `Server error (${res.status})`);
      }
    } catch (e: any) {
      setResolveError(`Connection issue: ${e.message || 'Unable to reach the server'}`);
      console.error(e);
    }
    finally { setResolving(false); }
  };

  // ── CSV Upload ──────────────────────────────────────────────────────────────
  const handleCSV = (file: File) => {
    setCsvError('');
    if (!file.name.endsWith('.csv')) {
      setCsvError('Only .csv files are supported. Please save your Excel file as CSV first.');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        setCsvError('CSV must have a header row + at least 1 data row.');
        return;
      }
      // Smart column detection from header
      const headerCols = lines[0].split(',').map(c => c.trim().replace(/"/g, '').toLowerCase());
      const nameIdx = headerCols.findIndex(h => h.includes('name') || h.includes('full'));
      const emailIdx = headerCols.findIndex(h => h.includes('email') || h.includes('mail'));
      const sapIdx = headerCols.findIndex(h => h.includes('sap') || h.includes('employee') || h.includes('id'));
      const dojIdx = headerCols.findIndex(h => h.includes('doj') || h.includes('join') || h.includes('date'));
      
      if (emailIdx === -1) {
        setCsvError('CSV must have an Email column. Found headers: ' + headerCols.join(', '));
        return;
      }
      
      const rows = lines.slice(1);
      const parsed: ManualCandidate[] = [];
      
      for (const row of rows) {
        const cols = row.split(',').map(c => c.trim().replace(/"/g, ''));
        if (cols.length < 2) continue;
        
        const name = nameIdx >= 0 ? (cols[nameIdx] || '') : (cols[0] || '');
        const email = cols[emailIdx] || '';
        const sap_id = sapIdx >= 0 ? (cols[sapIdx] || '') : '';
        const doj = dojIdx >= 0 ? (cols[dojIdx] || '') : '';
        
        if (!email || !email.includes('@')) continue;
        
        parsed.push({ 
          id: String(Date.now() + Math.random()),
          name, 
          email, 
          sap_id, 
          doj, 
          module_override: 'auto' 
        });
      }
      
      if (parsed.length === 0) {
        setCsvError('No valid rows found. Each row must have an email address with @.');
        return;
      }
      
      setManualCandidates(parsed);
    };
    reader.onerror = () => setCsvError('Failed to read file.');
    reader.readAsText(file);
  };

  const removeCandidate = (id: string) => setResolved(prev => prev.filter(c => c.id !== id));
  const updateCandidateModule = (id: string, mod: number | 'auto') => {
    setResolved(prev => prev.map(c => 
      c.id === id 
        ? { ...c, module_override: mod === 'auto' ? undefined : mod } 
        : c
    ));
  };
  const updateMan = (id: string, field: string, value: any) => {
    setManualCandidates(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };


  // ── Create batch ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!batchName.trim()) { setCreateError('Enter a batch name.'); return; }
    if (!date)             { setCreateError('Select a date.'); return; }
    if (!resolved.length)  { setCreateError('Resolve at least one registered candidate first.'); return; }

    setCreating(true);
    setCreateError('');
    try {
      const res = await fetchAPI('/api/hr/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          name: batchName,
          module_level: moduleMode === 'auto' ? null : moduleOverride,
          scheduled_date: date,
          scheduled_time: time,
          time_window_hours: timeMode === 'exact' ? 1 : windowHours,
          candidates: resolved.map(c => ({
            identifier: c.email,
            module_override: c.module_override,
          })),
        }),
      });
      let data: any = {};
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text || `Server returned status ${res.status}` };
      }
      if (res.ok) {
        setCreatedBatch({ batch_id: data.batch_id, total: data.total_scheduled, unresolved: data.unresolved || [] });
        loadBatches();
        setBatchName(''); setManualCandidates([{ id: '1', name: '', email: '', sap_id: '', doj: '', module_override: 'auto' }]); setResolved([]); setUnresolved([]);
      } else {
        setCreateError(data.detail?.error || data.detail || 'Failed to create batch.');
      }
    } catch (e: any) { 
      setCreateError(`Connection issue: ${e.message || 'Check API connection'}`); 
    }
    finally { setCreating(false); }
  };

  // ── Stagger preview ─────────────────────────────────────────────────────────
  const staggerGroups = Math.ceil(resolved.length / staggerGroup) || 0;
  const totalSpanMins = (staggerGroups - 1) * staggerMins + 40;

  // ── Batch progress ──────────────────────────────────────────────────────────
  const batchProgress = (b: Batch) => b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0;

  const card: React.CSSProperties = {
    background: '#fff', border: '1.5px solid #c7d2e0',
    borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
  };
  const cardHead: React.CSSProperties = {
    padding: '12px 20px', borderBottom: '1.5px solid #e8edf3',
    background: '#f0f4f8', display: 'flex', alignItems: 'center', gap: 8,
  };
  const inputCss: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 9,
    border: '1.5px solid #c7d2e0', fontSize: 13, color: '#1e293b',
    outline: 'none', background: '#f8fafc', boxSizing: 'border-box',
  };
  const gridInput: React.CSSProperties = {
    width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, 
    padding: '6px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif', display: 'flex' }}>
      <Sidebar active="Schedule" />

      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '100vh' }}>

        {/* ── Top Header ── */}
        <div style={{ background: '#fff', borderBottom: '1.5px solid #dde3ed', padding: '18px 32px', position: 'sticky', top: 0, zIndex: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#1e293b', fontFamily: 'Space Grotesk, sans-serif' }}>
                Schedule Interviews
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                Bulk-schedule AI interviews for registered TechBee candidates
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={loadBatches} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid #c7d2e0', background: '#fff', fontSize: 12, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Status Banner ── */}
        <div style={{ marginTop: 24, padding: '0 32px' }}>
          {createdBatch ? (
            <div style={{ padding: '16px 20px', borderRadius: 12, background: '#ecfdf5', border: '2px solid #10b981' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle2 size={18} color="#fff" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#065f46' }}>Batch scheduled successfully!</h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#047857' }}>
                      Invitations created. ID: <code>{createdBatch.batch_id}</code>
                    </p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
                  <button onClick={() => router.push(`/hr/schedule/${createdBatch.batch_id}`)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    View Batch Dashboard
                  </button>
                  <button onClick={() => {
                    setCreatedBatch(null);
                    setResolved([]);
                    setManualCandidates([{ id: '1', name: '', email: '', sap_id: '', doj: '', module_override: 'auto' }]);
                  }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Schedule Another
                  </button>
                </div>
            </div>
          ) : null}
        </div>

        <div style={{ padding: '20px 32px 40px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* ══ LEFT: Batch Creator ═══════════════════════════════════════════ */}
          <div style={{ flex: '0 0 510px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── 1. Batch Info ── */}
            <div style={card}>
              <div style={cardHead}>
                <CalendarPlus size={15} color="#6366f1" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Batch Details</span>
              </div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 5 }}>Batch Name *</label>
                  <input value={batchName} onChange={e => setBatchName(e.target.value)}
                    placeholder="e.g. Chennai Q3 2026" style={inputCss} />
                </div>

                {/* Module Mode */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>Module Level Assignment</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {([
                      { mode: 'auto',     icon: <ShieldCheck size={14} />, title: 'Auto (Recommended)', desc: "Each candidate's own module from DB" },
                      { mode: 'override', icon: <Settings size={14} />,     title: 'HR Override',        desc: 'Set same module for all in this batch' },
                    ] as { mode: ModuleMode; icon: React.ReactNode; title: string; desc: string }[]).map(({ mode, icon, title, desc }) => {
                      const sel = moduleMode === mode;
                      return (
                        <button key={mode} onClick={() => setModuleMode(mode)} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
                          borderRadius: 10, border: sel ? '2px solid #6366f1' : '2px solid #94a3b8',
                          background: sel ? '#6366f1' : '#e2e8f0', cursor: 'pointer', textAlign: 'left',
                          boxShadow: sel ? '0 4px 12px rgba(99,102,241,0.25)' : 'none', transition: 'all 0.15s',
                        }}>
                          <span style={{ color: sel ? '#fff' : '#475569', marginTop: 1 }}>{icon}</span>
                          <div>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: sel ? '#fff' : '#1e293b' }}>{title}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 10, color: sel ? 'rgba(255,255,255,0.8)' : '#64748b', lineHeight: 1.3 }}>{desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {moduleMode === 'auto' && (
                    <div style={{ padding: '10px 14px', borderRadius: 9, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Info size={13} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 11, color: '#065f46', lineHeight: 1.5 }}>
                        Each candidate will be interviewed for their current module from the system
                        (e.g. M2 for 2nd-year joiners). Module labels show below after resolving.
                      </p>
                    </div>
                  )}

                  {moduleMode === 'override' && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>Override Module for entire batch:</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                        {MODULE_LEVELS.map(m => {
                          const sel = moduleOverride === m.year;
                          return (
                            <button key={m.year} onClick={() => setModuleOverride(m.year)} style={{
                              padding: '8px 6px', borderRadius: 9,
                              border: sel ? `2px solid ${m.color}` : '2px solid #94a3b8',
                              background: sel ? m.color : '#e2e8f0', cursor: 'pointer', textAlign: 'left',
                              boxShadow: sel ? `0 3px 10px ${m.color}40` : 'none', transition: 'all 0.15s',
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: sel ? '#fff' : '#334155' }}>{m.label}</div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: sel ? '#fff' : '#1e293b' }}>{m.badge}</div>
                              <div style={{ fontSize: 9, color: sel ? 'rgba(255,255,255,0.7)' : '#64748b' }}>{m.sublabel}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── 2. Schedule & Time Mode ── */}
            <div style={card}>
              <div style={cardHead}>
                <Clock size={15} color="#6366f1" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Schedule & Timing</span>
              </div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 5 }}>Date *</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]} style={inputCss} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 5 }}>Start Time *</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputCss} />
                  </div>
                </div>

                {/* Time Mode Selector */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>Scheduling Mode</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {([
                      { mode: 'exact',     icon: <Zap size={13} />,           title: 'Exact Time',     desc: 'All candidates at the same moment. Good for small groups.' },
                      { mode: 'window',    icon: <Timer size={13} />,          title: 'Time Window',    desc: 'Candidates start anytime within a window. Best for large batches.' },
                      { mode: 'staggered', icon: <AlignJustify size={13} />,   title: 'Auto-Staggered', desc: 'System splits into groups with automatic time gaps between them.' },
                    ] as { mode: TimeMode; icon: React.ReactNode; title: string; desc: string }[]).map(({ mode, icon, title, desc }) => {
                      const sel = timeMode === mode;
                      return (
                        <button key={mode} onClick={() => setTimeMode(mode)} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                          borderRadius: 10, border: sel ? '2px solid #6366f1' : '2px solid #94a3b8',
                          background: sel ? '#6366f1' : '#e2e8f0', cursor: 'pointer', textAlign: 'left',
                          boxShadow: sel ? '0 3px 10px rgba(99,102,241,0.25)' : 'none', transition: 'all 0.15s',
                        }}>
                          <span style={{ color: sel ? '#fff' : '#475569', marginTop: 1 }}>{icon}</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: sel ? '#fff' : '#1e293b' }}>{title}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: sel ? 'rgba(255,255,255,0.8)' : '#64748b' }}>{desc}</p>
                          </div>
                          {sel && <Check size={13} color="#fff" style={{ flexShrink: 0, marginTop: 3 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Window options */}
                {timeMode === 'window' && (
                  <div style={{ padding: '14px 16px', borderRadius: 10, background: '#f0f4f8', border: '1.5px solid #c7d2e0' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>
                      Window: <strong style={{ color: '#6366f1' }}>{windowHours} hour{windowHours !== 1 ? 's' : ''}</strong>
                    </label>
                    <input type="range" min={1} max={24} value={windowHours} onChange={e => setWindowHours(+e.target.value)}
                      style={{ width: '100%', accentColor: '#6366f1' }} />
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#475569' }}>
                      Link valid from <strong>{time}</strong> for <strong>{windowHours}h</strong> on {date || 'selected date'}. Candidates can start anytime in this window.
                    </p>
                  </div>
                )}

                {/* Stagger options */}
                {timeMode === 'staggered' && (
                  <div style={{ padding: '14px 16px', borderRadius: 10, background: '#f0f4f8', border: '1.5px solid #c7d2e0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                        Candidates per slot: <strong style={{ color: '#6366f1' }}>{staggerGroup}</strong>
                      </label>
                      <input type="range" min={5} max={50} step={5} value={staggerGroup} onChange={e => setStaggerGroup(+e.target.value)}
                        style={{ width: '100%', accentColor: '#6366f1' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                        Gap between groups: <strong style={{ color: '#6366f1' }}>{staggerMins} min</strong>
                      </label>
                      <input type="range" min={15} max={120} step={15} value={staggerMins} onChange={e => setStaggerMins(+e.target.value)}
                        style={{ width: '100%', accentColor: '#6366f1' }} />
                    </div>
                    {resolved.length > 0 && (
                      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                        <p style={{ margin: 0, fontSize: 12, color: '#4338ca', fontWeight: 700 }}>
                          {resolved.length} candidates → {staggerGroups} group{staggerGroups !== 1 ? 's' : ''} of ~{staggerGroup}
                        </p>
                        <p style={{ margin: '3px 0 0', fontSize: 11, color: '#6366f1' }}>
                          Start: {time} &nbsp;|&nbsp; Total span: ~{totalSpanMins} min (incl. 40 min interview)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── 3. Candidate Input ── */}
            <div style={card}>
              <div style={cardHead}>
                <Users size={15} color="#6366f1" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Candidate List</span>
                {resolved.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: '#6366f1', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>
                    {resolved.length} resolved
                  </span>
                )}
              </div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Registered-only notice */}
                <div style={{ padding: '10px 14px', borderRadius: 9, background: '#f0f9ff', border: '1.5px solid #bae6fd', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <ShieldCheck size={14} color="#0284c7" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ margin: 0, fontSize: 11, color: '#0369a1', lineHeight: 1.5 }}>
                    <strong>CSV auto-registration enabled.</strong> Upload a CSV with columns: Name, Email, SAP ID, DOJ.
                    New candidates will be auto-registered in the system when you click Verify.
                  </p>
                </div>

                {/* Input mode toggle */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['manual', 'upload'] as const).map(m => (
                    <button key={m} onClick={() => setInputMode(m)} style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      border: inputMode === m ? '2px solid #6366f1' : '2px solid #94a3b8',
                      background: inputMode === m ? '#6366f1' : '#e2e8f0',
                      color: inputMode === m ? '#fff' : '#334155',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      {m === 'manual' ? '✏️  Manual Entry' : '📄  Upload CSV'}
                    </button>
                  ))}
                </div>

                {inputMode === 'manual' ? (
                  <div style={{ border: '1px solid #c7d2e0', borderRadius: 9, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '8px 10px', color: '#475569', fontWeight: 600 }}>Full Name</th>
                          <th style={{ padding: '8px 10px', color: '#475569', fontWeight: 600 }}>Email *</th>
                          <th style={{ padding: '8px 10px', color: '#475569', fontWeight: 600 }}>SAP ID</th>
                          <th style={{ padding: '8px 10px', color: '#475569', fontWeight: 600 }}>DOJ</th>
                          <th style={{ padding: '8px 10px', color: '#475569', fontWeight: 600 }}>Module (opt)</th>
                          <th style={{ padding: '8px 10px', width: 30 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualCandidates.map((c) => (
                          <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: 4 }}><input style={gridInput} placeholder="Full Name" value={c.name} onChange={e => updateMan(c.id, 'name', e.target.value)} /></td>
                            <td style={{ padding: 4 }}><input style={gridInput} placeholder="Email" value={c.email} onChange={e => updateMan(c.id, 'email', e.target.value)} /></td>
                            <td style={{ padding: 4 }}><input style={gridInput} placeholder="SAP ID" value={c.sap_id} onChange={e => updateMan(c.id, 'sap_id', e.target.value)} /></td>
                            <td style={{ padding: 4 }}><input type="date" style={gridInput} value={c.doj} onChange={e => updateMan(c.id, 'doj', e.target.value)} /></td>
                            <td style={{ padding: 4 }}>
                               <select style={gridInput} value={c.module_override} onChange={e => updateMan(c.id, 'module_override', e.target.value === 'auto' ? 'auto' : parseInt(e.target.value))}>
                                  <option value="auto">Auto</option>
                                  {MODULE_LEVELS.map(m => <option key={m.year} value={m.year}>M{m.year}</option>)}
                               </select>
                            </td>
                            <td style={{ padding: 4, textAlign: 'center' }}>
                              <button onClick={() => setManualCandidates(prev => prev.filter(p => p.id !== c.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '8px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                       <button onClick={() => setManualCandidates(prev => [...prev, { id: Math.random().toString(), name: '', email: '', sap_id: '', doj: '', module_override: 'auto' }])} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Plus size={14} /> Add Row
                       </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCSV(f); }}
                    onDragOver={e => e.preventDefault()}
                    style={{ border: '2px dashed #94a3b8', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}
                  >
                    <Upload size={22} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#475569' }}>Drop CSV file here or click to browse</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>Expected columns: Name, Email, SAP ID, DOJ (first row = header)</p>
                    <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCSV(f); }} />
                  </div>
                )}

                {csvError && (
                  <div style={{ padding: '10px 14px', borderRadius: 9, background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <AlertTriangle size={14} color="#dc2626" style={{ flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{csvError}</p>
                  </div>
                )}


                {/* Resolve button */}
                {manualCandidates.some(c => c.email.includes('@')) && (
                  <button onClick={handleResolve} disabled={resolving} style={{
                    padding: '10px 18px', borderRadius: 9, border: 'none',
                    background: resolving ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff', fontWeight: 700, fontSize: 13, cursor: resolving ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                  }}>
                    {resolving ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    {resolving ? 'Registering & verifying…' : 'Verify candidates'}
                  </button>
                )}

                {resolveError && (
                  <div style={{ padding: '10px 14px', borderRadius: 9, background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <AlertTriangle size={14} color="#dc2626" style={{ flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{resolveError}</p>
                  </div>
                )}

                {/* Resolved candidates */}
                {resolved.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={13} /> {resolved.length} registered candidates found:
                    </p>
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                            <th style={{ padding: '8px 12px', fontWeight: 700 }}>Name</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700 }}>Email ID</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700 }}>SAP ID</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700 }}>DOJ</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700 }}>Module</th>
                            <th style={{ padding: '8px 12px', width: 40 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {resolved.map(c => {
                            return (
                              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>
                                <td style={{ padding: '8px 12px', color: '#047857', fontWeight: 600 }}>{c.name || '—'}</td>
                                <td style={{ padding: '8px 12px', color: '#047857' }}>{c.email}</td>
                                <td style={{ padding: '8px 12px', color: '#047857', fontFamily: 'monospace' }}>{c.sap_id || '—'}</td>
                                <td style={{ padding: '8px 12px', color: '#047857' }}>{c.join_date ? new Date(c.join_date).toLocaleDateString() : '—'}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  {moduleMode === 'override' ? (
                                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: MODULE_LEVELS.find(m => m.year === moduleOverride)?.color || '#94a3b8', color: '#fff' }}>
                                      M{moduleOverride} (Global Override)
                                    </span>
                                  ) : (
                                    <select
                                      value={c.module_override ?? 'auto'}
                                      onChange={(e) => updateCandidateModule(c.id, e.target.value === 'auto' ? 'auto' : parseInt(e.target.value))}
                                      style={{
                                        fontSize: 10, padding: '2px 6px', borderRadius: 5,
                                        border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a',
                                        outline: 'none', cursor: 'pointer', fontWeight: 600
                                      }}
                                    >
                                      <option value="auto">Auto (M{c.current_module})</option>
                                      {MODULE_LEVELS.map(m => (
                                        <option key={m.year} value={m.year}>M{m.year} - {m.badge}</option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <button onClick={() => removeCandidate(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                                    <X size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Unresolved (not registered) */}
                {unresolved.length > 0 && (
                  <div style={{ padding: '10px 14px', borderRadius: 9, background: '#fef2f2', border: '1.5px solid #fecaca' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <UserX size={13} /> {unresolved.length} not registered in system:
                    </p>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: '#b91c1c', fontFamily: 'monospace', lineHeight: 1.6 }}>
                      {unresolved.join(' · ')}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button onClick={() => router.push('/hr/candidates')} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Register Candidates →
                      </button>
                      <p style={{ margin: 'auto 0', fontSize: 10, color: '#ef4444' }}>
                        Only registered candidates with SAP ID + org email can take the interview.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {createError && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca', fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                {createError}
              </div>
            )}

            {/* Submit */}
            <button onClick={handleCreate} disabled={creating} style={{
              padding: '15px 24px', borderRadius: 12, border: 'none',
              background: creating ? '#94a3b8' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color: '#fff', fontWeight: 800, fontSize: 15, cursor: creating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
              boxShadow: creating ? 'none' : '0 4px 20px rgba(79,70,229,0.35)', width: '100%',
              transition: 'all 0.2s',
            }}>
              {creating ? <Loader2 size={17} className="animate-spin" /> : <Mail size={17} />}
              {creating ? 'Creating…' : `Schedule ${resolved.length || '?'} Interview${resolved.length !== 1 ? 's' : ''}`}
            </button>
          </div>

          {/* ══ RIGHT: Batches List ══════════════════════════════════════════ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b', fontFamily: 'Space Grotesk, sans-serif' }}>
                Active Batches
              </h2>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{batches.length} total</span>
            </div>

            {batchLoadError && (
              <div style={{ padding: '10px 14px', borderRadius: 9, background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={14} color="#dc2626" style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{batchLoadError}</p>
              </div>
            )}

            {loadingBatches ? (
              <div style={{ ...card, padding: '40px', textAlign: 'center' }}>
                <Loader2 size={22} color="#6366f1" className="animate-spin" style={{ margin: '0 auto 10px' }} />
                <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>Loading batches…</p>
              </div>
            ) : batches.length === 0 ? (
              <div style={{ ...card, padding: '48px 32px', textAlign: 'center' }}>
                <CalendarPlus size={38} color="#c7d2e0" style={{ margin: '0 auto 14px' }} />
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>No batches yet</p>
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Create your first batch using the form.</p>
              </div>
            ) : (
              batches.map(b => {
                const pct = batchProgress(b);
                const dt = b.scheduled_at
                  ? new Date(b.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Not scheduled';
                return (
                  <div key={b.batch_id} style={card}>
                    <div style={{ padding: '14px 18px', borderBottom: '1.5px solid #e8edf3', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <h3 style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{b.batch_name}</h3>
                        <p style={{ margin: 0, fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={10} /> {dt}
                        </p>
                      </div>
                      <button onClick={() => router.push(`/hr/schedule/${b.batch_id}`)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1.5px solid #c7d2e0', background: '#fff', fontSize: 11, fontWeight: 700, color: '#475569', cursor: 'pointer', flexShrink: 0 }}>
                        <Eye size={12} /> View
                      </button>
                    </div>
                    <div style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Completion</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#6366f1' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 8, background: '#e2e8f0', overflow: 'hidden', marginBottom: 12 }}>
                        <div style={{ height: '100%', borderRadius: 8, background: pct === 100 ? '#10b981' : 'linear-gradient(90deg,#6366f1,#8b5cf6)', width: `${pct}%`, transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Total',     value: b.total,     color: '#6366f1', bg: '#eef2ff' },
                          { label: 'Pending',   value: b.pending,   color: '#f59e0b', bg: '#fffbeb' },
                          { label: 'Completed', value: b.completed, color: '#10b981', bg: '#ecfdf5' },
                          { label: 'Active',    value: b.active,    color: '#3b82f6', bg: '#eff6ff' },
                        ].map(({ label, value, color, bg }) => (
                          <div key={label} style={{ padding: '4px 10px', borderRadius: 20, background: bg, border: `1px solid ${color}30` }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color }}>{value} {label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
