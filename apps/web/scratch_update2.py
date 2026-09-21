import re

file_path = r'c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\web\app\hr\schedule\page.tsx'
with open(file_path, 'r', encoding='utf-8') as f: content = f.read()

# Chunk 5: clearing state
content = content.replace(
    "setBatchName(''); setPasteText(''); setResolved([]); setUnresolved([]);",
    "setBatchName(''); setManualCandidates([{ id: '1', name: '', email: '', sap_id: '', doj: '', module_override: 'auto' }]); setResolved([]); setUnresolved([]);"
)

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
