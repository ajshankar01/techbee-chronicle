import os
import glob

# Python files
files = glob.glob(r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\**\*.py", recursive=True)

for file in files:
    with open(file, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Fix dict keys
    content = content.replace('"vision_and_mission":', '"vision_and_mission":')
    # Fix gemini dict gets
    content = content.replace('gemini_scores.get("vision_and_mission", 77)', 'gemini_scores.get("vision_and_mission", 77)')
    
    with open(file, "w", encoding="utf-8") as f:
        f.write(content)

print("Fixed syntax errors!")
