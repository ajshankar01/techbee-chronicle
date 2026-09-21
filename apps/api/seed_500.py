import asyncio
import os
import sys
import uuid
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.models import QuestionBank, QuestionType
from sqlalchemy import text, delete

# Generate some templates for each category
templates = {
    QuestionType.PSYCHOMETRIC: [
        "How do you handle a situation where {var1}?",
        "Describe a time you had to deal with {var1}.",
        "What is your approach to {var1} when {var2}?",
        "If you discover {var1}, how would you {var2}?",
        "Tell me about a time you struggled with {var1}."
    ],
    QuestionType.ENDURANCE: [
        "When {var1} fails at 3 AM, how do you {var2}?",
        "Describe a long-term project where you had to {var1}.",
        "How do you maintain focus when {var1}?",
        "Tell me about a time {var1} was extremely difficult and you {var2}.",
        "What keeps you motivated when dealing with {var1}?"
    ],
    QuestionType.COGNITIVE_ABILITY: [
        "Explain how you would solve {var1}.",
        "If {var1} is broken, what is your first step to {var2}?",
        "How do you analyze a complex system involving {var1}?",
        "Walk me through your process for {var1}.",
        "Describe a challenging puzzle involving {var1} and how you solved it."
    ],
    QuestionType.FORENSIC_ANALYSIS: [
        "A system was hacked via {var1}. How do you {var2}?",
        "If you find {var1} in the logs, what is your next step?",
        "How do you investigate a data breach involving {var1}?",
        "Describe your methodology for tracing {var1}.",
        "What evidence would you look for if {var1} occurred?"
    ],
    QuestionType.ADAPTABILITY: [
        "Tell me about a time you had to quickly adapt to {var1}.",
        "How do you handle sudden changes in {var1}?",
        "If your main tool for {var1} is unavailable, how do you {var2}?",
        "Describe a project where the requirements for {var1} changed overnight.",
        "How do you stay flexible when {var1} is uncertain?"
    ],
    QuestionType.COMMUNICATION: [
        "How do you explain {var1} to a non-technical stakeholder?",
        "Tell me about a time you had a miscommunication regarding {var1}.",
        "How do you document {var1} so others can {var2}?",
        "Describe a presentation you gave about {var1}.",
        "How do you resolve a disagreement about {var1}?"
    ],
    QuestionType.TEAM_MANAGEMENT: [
        "How do you handle an underperforming team member struggling with {var1}?",
        "Describe a time you successfully delegated {var1}.",
        "How do you foster collaboration on {var1}?",
        "Tell me about a time you resolved a conflict over {var1}.",
        "How do you ensure your team stays motivated while working on {var1}?"
    ],
    QuestionType.LEADERSHIP_QUALITY: [
        "Describe a time you took the lead on {var1}.",
        "How do you inspire others to {var2} when facing {var1}?",
        "Tell me about a tough decision you made regarding {var1}.",
        "How do you align your team's goals with {var1}?",
        "Describe a mentorship experience involving {var1}."
    ],
    QuestionType.VISION_AND_MISSION: [
        "How does {var1} align with your long-term career goals?",
        "Describe a time you sacrificed short-term gains for {var1}.",
        "How do you ensure your daily work reflects {var1}?",
        "Tell me about a project where you defined the vision for {var1}.",
        "Where do you see the future of {var1} heading?"
    ],
    QuestionType.STRATEGIC_THINKING: [
        "How do you plan for {var1} over the next 5 years?",
        "Describe a time you identified a strategic risk related to {var1}.",
        "How do you prioritize {var1} over {var2}?",
        "Tell me about a time you implemented a strategic framework for {var1}.",
        "How do you measure the strategic impact of {var1}?"
    ]
}

variables1 = ["a critical production outage", "a difficult team dynamic", "a tight deadline", "an ambiguous requirement", "a legacy system integration", "a sudden shift in priorities", "a resource constraint", "a misaligned stakeholder", "an ethical dilemma", "a disruptive technology"]
variables2 = ["ensure success", "mitigate the risk", "communicate effectively", "find the root cause", "maintain morale", "deliver on time", "adapt your strategy", "lead the team forward", "resolve the conflict", "document the process"]

async def main():
    async with AsyncSessionLocal() as db:
        print("Clearing old questions...")
        await db.execute(delete(QuestionBank))
        
        print("Generating 50 questions per category...")
        total = 0
        for q_type, tmpls in templates.items():
            questions = []
            for i in range(50):
                tmpl = tmpls[i % len(tmpls)]
                v1 = variables1[(i + len(tmpl)) % len(variables1)]
                v2 = variables2[(i + 2*len(tmpl)) % len(variables2)]
                
                text = tmpl.replace("{var1}", v1).replace("{var2}", v2)
                
                # Cycle through modules 1, 2, 3
                module = (i % 3) + 1
                
                q = QuestionBank(
                    id=uuid.uuid4(),
                    question_type=q_type,
                    question_text=text,
                    tags={"source": "seed", "difficulty": "medium", "bond_year": module},
                    is_active=True,
                    created_by_id=uuid.UUID("d3b07384-d113-4ef6-a5db-3c58ded506e7")
                )
                questions.append(q)
            
            db.add_all(questions)
            await db.commit()
            print(f"Committed {len(questions)} for {q_type.value}")
            total += len(questions)
        print(f"Successfully seeded {total} questions.")

if __name__ == "__main__":
    asyncio.run(main())
