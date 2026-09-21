import re

with open("c:/Users/ajsha/Documents/antigravity/lucid-heisenberg/apps/api/app/routers/interview.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace AnalysisResult creation in _run_post_interview_analysis
# We'll use regex to find the start of `analysis = AnalysisResult(` to `db.add(analysis)`
pattern = r"analysis = AnalysisResult\([\s\S]*?analyzed_at=datetime.now\(timezone.utc\),\s*\)\s*db.add\(analysis\)"

replacement = """a_res = await db.execute(select(AnalysisResult).where(AnalysisResult.session_id == session.id))
            analysis = a_res.scalar_one_or_none()
            if not analysis:
                analysis = AnalysisResult(session_id=session.id)
                db.add(analysis)
            
            analysis.communication_score = analysis_data.get("communication_score")
            analysis.areas_of_improvement = analysis_data.get("areas_of_improvement", [])
            analysis.analyzed_at = datetime.now(timezone.utc)"""

new_content = re.sub(pattern, replacement, content)

if new_content == content:
    print("No changes made. Pattern not found.")
else:
    with open("c:/Users/ajsha/Documents/antigravity/lucid-heisenberg/apps/api/app/routers/interview.py", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Patched interview.py")
