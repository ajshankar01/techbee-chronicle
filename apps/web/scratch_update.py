import re

file_path = r'c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\web\app\hr\schedule\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Chunk 1: State
content = content.replace(
"""  const [pasteText,    setPasteText]    = useState('');
  const [resolved,     setResolved]     = useState<ResolvedCandidate[]>([]);
  const [unresolved,   setUnresolved]   = useState<string[]>([]);
  const [resolving,    setResolving]    = useState(false);
  const [inputMode,    setInputMode]    = useState<'paste' | 'upload'>('paste');
  const [csvCandidates, setCsvCandidates] = useState<{name: string; email: string; sap_id: string; doj: string}[]>([]);
  const [csvError, setCsvError] = useState('');""",
"""  const [manualCandidates, setManualCandidates] = useState<{id: string; name: string; email: string; sap_id: string; doj: string; module_override: number | 'auto'}[]>([{ id: '1', name: '', email: '', sap_id: '', doj: '', module_override: 'auto' }]);
  const [resolved,     setResolved]     = useState<ResolvedCandidate[]>([]);
  const [unresolved,   setUnresolved]   = useState<string[]>([]);
  const [resolving,    setResolving]    = useState(false);
  const [inputMode,    setInputMode]    = useState<'manual' | 'upload'>('manual');
  const [csvError, setCsvError] = useState('');"""
)

# Chunk 2: handleResolve
old_resolve = """  // ── Parse paste text ────────────────────────────────────────────────────────
  const parseIdentifiers = (text: string): string[] =>
    text.split(/[\\n,;]+/).map(s => s.trim()).filter(Boolean);

  // ── Resolve candidates ──────────────────────────────────────────────────────
  const handleResolve = async () => {
    setResolveError('');
    // If we have structured CSV data, use the register-and-resolve endpoint
    if (csvCandidates.length > 0) {
      setResolving(true);
      setResolved([]);
      setUnresolved([]);
      try {
        const res = await fetch(`${API}/api/hr/batches/register-and-resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ candidates: csvCandidates }),
        });
        if (res.ok) {
          const data = await res.json();
          setResolved(data.resolved || []);
          setUnresolved(data.errors || []);
        } else {
          const err = await res.json().catch(() => ({}));
          setResolveError(err.detail?.error || err.detail || `Server error (${res.status})`);
        }
      } catch (e) {
        setResolveError('Network error — is the API server running on port 8000?');
        console.error(e);
      }
      finally { setResolving(false); }
      return;
    }

    // Fallback: paste mode — try register-and-resolve with email parsing
    const ids = parseIdentifiers(pasteText);
    if (!ids.length) return;
    setResolving(true);
    setResolved([]);
    setUnresolved([]);
    try {
      const entries = ids.map(id => ({
        name: id.includes('@') ? id.split('@')[0].replace(/[._]/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : id,
        email: id.includes('@') ? id : `${id.toLowerCase()}@techbee.in`,
        sap_id: !id.includes('@') ? id : '',
        doj: '',
      }));
      const res = await fetch(`${API}/api/hr/batches/register-and-resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ candidates: entries }),
      });
      if (res.ok) {
        const data = await res.json();
        setResolved(data.resolved || []);
        setUnresolved(data.errors || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setResolveError(err.detail?.error || err.detail || `Server error (${res.status})`);
      }
    } catch (e) {
      setResolveError('Network error — is the API server running on port 8000?');
      console.error(e);
    }
    finally { setResolving(false); }
  };"""

new_resolve = """  // ── Resolve candidates ──────────────────────────────────────────────────────
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
      const res = await fetch(`${API}/api/hr/batches/register-and-resolve`, {
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
    } catch (e) {
      setResolveError('Network error — is the API server running on port 8000?');
      console.error(e);
    }
    finally { setResolving(false); }
  };"""

content = content.replace(old_resolve, new_resolve)

# Chunk 3: CSV parse
old_csv = """      const rows = lines.slice(1);
      const parsed: {name: string; email: string; sap_id: string; doj: string}[] = [];
      const displayLines: string[] = [];
      
      for (const row of rows) {
        const cols = row.split(',').map(c => c.trim().replace(/"/g, ''));
        if (cols.length < 2) continue;
        
        const name = nameIdx >= 0 ? (cols[nameIdx] || '') : (cols[0] || '');
        const email = cols[emailIdx] || '';
        const sap_id = sapIdx >= 0 ? (cols[sapIdx] || '') : '';
        const doj = dojIdx >= 0 ? (cols[dojIdx] || '') : '';
        
        if (!email || !email.includes('@')) continue;
        
        parsed.push({ name, email, sap_id, doj });
        displayLines.push(`${name} | ${email} | ${sap_id}`);
      }
      
      if (parsed.length === 0) {
        setCsvError('No valid rows found. Each row must have an email address with @.');
        return;
      }
      
      setCsvCandidates(parsed);
      setPasteText(displayLines.join('\\n'));
      setInputMode('paste'); // Switch to paste view to show parsed data"""

new_csv = """      const rows = lines.slice(1);
      const parsed = [];
      for (const row of rows) {
        const cols = row.split(',').map(c => c.trim().replace(/"/g, ''));
        if (cols.length < 2) continue;
        
        const name = nameIdx >= 0 ? (cols[nameIdx] || '') : (cols[0] || '');
        const email = cols[emailIdx] || '';
        const sap_id = sapIdx >= 0 ? (cols[sapIdx] || '') : '';
        const doj = dojIdx >= 0 ? (cols[dojIdx] || '') : '';
        
        if (!email || !email.includes('@')) continue;
        
        parsed.push({ id: Math.random().toString(), name, email, sap_id, doj, module_override: 'auto' as const });
      }
      
      if (parsed.length === 0) {
        setCsvError('No valid rows found. Each row must have an email address with @.');
        return;
      }
      
      setManualCandidates(parsed);
      setInputMode('manual');"""

content = content.replace(old_csv, new_csv)

# Chunk 4: updateMan
old_upd = """  const removeCandidate = (id: string) => setResolved(prev => prev.filter(c => c.id !== id));
  const updateCandidateModule = (id: string, mod: number | 'auto') => {
    setResolved(prev => prev.map(c => 
      c.id === id 
        ? { ...c, module_override: mod === 'auto' ? undefined : mod } 
        : c
    ));
  };"""

new_upd = """  const removeCandidate = (id: string) => setResolved(prev => prev.filter(c => c.id !== id));
  const updateCandidateModule = (id: string, mod: number | 'auto') => {
    setResolved(prev => prev.map(c => 
      c.id === id 
        ? { ...c, module_override: mod === 'auto' ? undefined : mod } 
        : c
    ));
  };
  const updateMan = (id: string, field: string, value: any) => {
    setManualCandidates(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };"""

content = content.replace(old_upd, new_upd)

# Chunk 5: clearing state
content = content.replace(
    "setBatchName(''); setPasteText(''); setResolved([]); setUnresolved([]);",
    "setBatchName(''); setManualCandidates([{ id: '1', name: '', email: '', sap_id: '', doj: '', module_override: 'auto' }]); setResolved([]); setUnresolved([]);"
)

# Chunk 6: Grid css
old_css = """  const inputCss: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 9,
    border: '1.5px solid #c7d2e0', fontSize: 13, color: '#1e293b',
    outline: 'none', background: '#f8fafc', boxSizing: 'border-box',
  };"""

new_css = """  const inputCss: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 9,
    border: '1.5px solid #c7d2e0', fontSize: 13, color: '#1e293b',
    outline: 'none', background: '#f8fafc', boxSizing: 'border-box',
  };
  const gridInput: React.CSSProperties = {
    width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, 
    padding: '6px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box'
  };"""

content = content.replace(old_css, new_css)

# Chunk 7: Render mode
old_render = """                {/* Input mode toggle */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['paste', 'upload'] as const).map(m => (
                    <button key={m} onClick={() => setInputMode(m)} style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      border: inputMode === m ? '2px solid #6366f1' : '2px solid #94a3b8',
                      background: inputMode === m ? '#6366f1' : '#e2e8f0',
                      color: inputMode === m ? '#fff' : '#334155',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      {m === 'paste' ? '✏️  Paste SAP / Emails' : '📄  Upload CSV'}
                    </button>
                  ))}
                </div>

                {inputMode === 'paste' ? (
                  <div>
                    <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                      placeholder={"SAP IDs or org emails — one per line:\\nSAP100492\\nSAP100493\\npriya.sharma@hcltech.com"}
                      rows={5}
                      style={{ ...inputCss, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, padding: '10px 12px' }}
                    />
                    <p style={{ margin: '5px 0 0', fontSize: 11, color: '#94a3b8' }}>
                      Comma, semicolon, or newline separated. SAP IDs and org email addresses both accepted.
                    </p>
                  </div>"""

new_render = """                {/* Input mode toggle */}
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
                  </div>"""

content = content.replace(old_render, new_render)

# Chunk 8: Button disable
old_btn = """                {/* Resolve button */}
                {pasteText.trim() && (
                  <button onClick={handleResolve} disabled={resolving} style={{
                    padding: '10px 18px', borderRadius: 9, border: 'none',
                    background: resolving ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff', fontWeight: 700, fontSize: 13, cursor: resolving ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',"""

new_btn = """                {/* Resolve button */}
                {manualCandidates.some(c => c.email.includes('@')) && (
                  <button onClick={handleResolve} disabled={resolving} style={{
                    padding: '10px 18px', borderRadius: 9, border: 'none',
                    background: resolving ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff', fontWeight: 700, fontSize: 13, cursor: resolving ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',"""

content = content.replace(old_btn, new_btn)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
