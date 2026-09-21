import re

file_path = r'c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\web\app\hr\schedule\page.tsx'
with open(file_path, 'r', encoding='utf-8') as f: content = f.read()

# Add imports
content = content.replace("ShieldCheck, UserX, Settings", "ShieldCheck, UserX, Settings, Trash2, Plus")

# Fix line 400
content = content.replace(
    "setPasteText('');",
    "setManualCandidates([{ id: '1', name: '', email: '', sap_id: '', doj: '', module_override: 'auto' }]);"
)

# Fix line 691
old_line = "{resolving ? 'Registering & verifying…' : csvCandidates.length > 0 ? `Register & verify ${csvCandidates.length} candidates` : `Verify ${parseIdentifiers(pasteText).length} identifiers`}"
new_line = "{resolving ? 'Registering & verifying…' : 'Verify candidates'}"
content = content.replace(old_line, new_line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
