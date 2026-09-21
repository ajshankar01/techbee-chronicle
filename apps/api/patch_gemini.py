import re

with open("c:/Users/ajsha/Documents/antigravity/lucid-heisenberg/apps/api/app/services/gemini_service.py", "r", encoding="utf-8") as f:
    content = f.read()

new_func = """async def analyze_interview_session(
    session_data: dict = None,
    candidate_name: str = "Candidate",
    full_transcript: list = None,
    behavioral_data: dict = None,
    previous_snapshot: dict = None,
    prior_qa_pairs: list = None,
    bond_year: int = 1
) -> dict:
    \"\"\"
    Simplified AI evaluation focusing ONLY on communication (fluency, articulation).
    \"\"\"
    if session_data is not None:
        candidate_name = session_data.get("candidate_name", candidate_name)
        full_transcript = []
        for r in session_data.get("responses", []):
            full_transcript.append({
                "speaker": "aria",
                "text": r.get("question", "")
            })
            full_transcript.append({
                "speaker": "candidate",
                "text": r.get("response", "")
            })

    candidate_texts = []
    if full_transcript:
        for entry in full_transcript:
            if entry.get("speaker") == "candidate" and entry.get("text"):
                candidate_texts.append(entry["text"].strip())

    combined_candidate_text = " ".join(candidate_texts).strip()

    if len(combined_candidate_text) < 30:
        logger.warning(f"⚠️ Candidate {candidate_name} remained silent. Enforcing automatic evaluation failure.")
        return {
            "communication_score": 0,
            "areas_of_improvement": ["Must actively respond and participate."]
        }

    prompt = f\"\"\"[COMMUNICATION EVALUATION] Candidate: {candidate_name}

TRANSCRIPT:
{combined_candidate_text}

Evaluate the candidate's communication skills (fluency, articulation, clarity) based on the transcript.
Return ONLY valid JSON matching this schema:
{{
  "communication_score": 85,
  "areas_of_improvement": ["Use less filler words", "Be more concise"]
}}
\"\"\"
    result = await _gemini_generate(prompt, max_tokens=1000)
    if result:
        try:
            clean = result.strip()
            if clean.startswith("```"):
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
            parsed = json.loads(clean.strip())
            return {
                "communication_score": parsed.get("communication_score", 0),
                "areas_of_improvement": parsed.get("areas_of_improvement", [])
            }
        except Exception as e:
            logger.error(f"Gemini analysis JSON parse failed: {e}")

    # Fallback
    return {
        "communication_score": 75,
        "areas_of_improvement": ["Practice articulating complex ideas more clearly."]
    }
"""

# Replace from `async def analyze_interview_session` to the end of the function.
# The function ends just before `# Alias for router compatibility`
start_idx = content.find("async def analyze_interview_session")
end_idx = content.find("# Alias for router compatibility")

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + new_func + "\n\n" + content[end_idx:]
    with open("c:/Users/ajsha/Documents/antigravity/lucid-heisenberg/apps/api/app/services/gemini_service.py", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Patched gemini_service.py")
else:
    print("Could not find boundaries")
