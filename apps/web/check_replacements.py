import re

file_path = r'c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\web\app\hr\schedule\page.tsx'
with open(file_path, 'r', encoding='utf-8') as f: content = f.read()

chunks = [
  ("Chunk 1: State", "const [pasteText,    setPasteText]    = useState('');"),
  ("Chunk 2: handleResolve", "const handleResolve = async () => {"),
  ("Chunk 3: CSV parse", "const rows = lines.slice(1);"),
  ("Chunk 4: updateMan", "const removeCandidate = (id: string) => setResolved(prev => prev.filter(c => c.id !== id));"),
  ("Chunk 5: clearing state", "setBatchName(''); setPasteText(''); setResolved([]); setUnresolved([]);"),
  ("Chunk 6: Grid css", "const inputCss: React.CSSProperties = {"),
  ("Chunk 7: Render mode", "const sel = moduleMode === mode;"),
  ("Chunk 8: Button disable", "{pasteText.trim() && (")
]

for name, snip in chunks:
    if snip in content:
        print(f"FOUND: {name}")
    else:
        print(f"MISSING: {name}")
