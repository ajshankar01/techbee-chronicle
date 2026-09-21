import os

files_to_update = [
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\services\pdf_service.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\services\gemini_service.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\routers\reports.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\routers\questions.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\routers\batches.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\web\app\hr\schedule\page.tsx",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\models\models.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\web\app\hr\questions\page.tsx",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\core\seeder.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\routers\interview.py",
]

for file_path in files_to_update:
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace MURDER_SOLVING first (so we don't accidentally get lowercased versions from it)
    content = content.replace("MURDER_SOLVING", "FORENSIC_ANALYSIS")
    content = content.replace("murder_solving", "forensic_analysis")
    content = content.replace("Murder Solving", "Forensic Analysis")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated {file_path}")
