import os

files_to_update = [
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\services\pdf_service.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\services\gemini_service.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\routers\reports.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\routers\questions.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\routers\batches.py",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\web\app\hr\schedule\page.tsx",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\web\app\hr\questions\page.tsx",
    r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api\app\routers\interview.py",
]

replacements = {
    # pdf_service.py
    '"vision_and_mission": "🔭 Vision & Mission",': '"vision_and_mission": "🔭 Vision & Mission",\n        "strategic_thinking": "♟️ Strategic Thinking",',
    '"vision_and_mission"': '"vision_and_mission", "strategic_thinking"',
    
    # questions/page.tsx
    'vision_and_mission: "Vision & Mission",': 'vision_and_mission: "Vision & Mission",\n  strategic_thinking: "Strategic Thinking",',
    'vision_and_mission: { primary: "#6366F1", bg: "rgba(99, 102, 241, 0.1)", border: "rgba(99, 102, 241, 0.25)" },': 'vision_and_mission: { primary: "#6366F1", bg: "rgba(99, 102, 241, 0.1)", border: "rgba(99, 102, 241, 0.25)" },\n  strategic_thinking: { primary: "#0EA5E9", bg: "rgba(14, 165, 233, 0.1)", border: "rgba(14, 165, 233, 0.25)" },',
    'vision_and_mission: questions.filter(q => q.type === "vision_and_mission").length,': 'vision_and_mission: questions.filter(q => q.type === "vision_and_mission").length,\n    strategic_thinking: questions.filter(q => q.type === "strategic_thinking").length,',
    
    # gemini_service.py
    '"vision_and_mission": 0}': '"vision_and_mission": 0, "strategic_thinking": 0}',
    'vision_and_mission"]': 'vision_and_mission", "strategic_thinking"]',
    '"vision_and_mission": 80}': '"vision_and_mission": 80, "strategic_thinking": 80}',
    '"vision_and_mission": 82}': '"vision_and_mission": 82, "strategic_thinking": 82}',
    '"vision_and_mission": "Because they maintained energy levels through all questions, this behavior is calculated at 80%."': '"vision_and_mission": "Because they maintained energy levels through all questions, this behavior is calculated at 80%.",\n    "strategic_thinking": "They demonstrated good foresight, calculated at 80%."',
    
    # schedule/page.tsx
    "{ key: 'vision_and_mission', label: 'Vision & Mission',   color: '#6366f1' },": "{ key: 'vision_and_mission', label: 'Vision & Mission',   color: '#6366f1' },\n  { key: 'strategic_thinking', label: 'Strategic Thinking', color: '#0ea5e9' },",
    
    # reports.py
    '"vision_and_mission": analysis.vision_and_mission_score,': '"vision_and_mission": analysis.vision_and_mission_score,\n                    "strategic_thinking": analysis.strategic_thinking_score,',
    '"vision_and_mission": 77,': '"vision_and_mission": 77, "strategic_thinking": 81,',
    '"vision_and_mission", 77),': '"vision_and_mission", 77),\n            "strategic_thinking": gemini_scores.get("strategic_thinking", 81),',
    'vision_and_mission_score=scores["vision_and_mission"],': 'vision_and_mission_score=scores["vision_and_mission"],\n                    strategic_thinking_score=scores.get("strategic_thinking", 80),',
    'analysis_db_obj.vision_and_mission_score = scores["vision_and_mission"]': 'analysis_db_obj.vision_and_mission_score = scores["vision_and_mission"]\n                analysis_db_obj.strategic_thinking_score = scores.get("strategic_thinking", 80)',
    
    # questions.py & batches.py
    '"vision_and_mission": QuestionType.VISION_AND_MISSION,': '"vision_and_mission": QuestionType.VISION_AND_MISSION,\n        "strategic_thinking": QuestionType.STRATEGIC_THINKING,',
    
}

for file_path in files_to_update:
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    for old, new in replacements.items():
        if old in content:
            content = content.replace(old, new)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated {file_path}")
