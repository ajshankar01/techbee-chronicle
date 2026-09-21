"""
seed_balanced_psychometric.py
===========================================
Seeds 20 balanced psychometric questions into the `psychometric_questions` table.

Balance design:
  SA ideal (7 Qs) — normal positive trait markers
  SD ideal (7 Qs) — reverse-scored; Strongly Disagree = healthy
  N  ideal (6 Qs) — nuanced middle-ground statements

Run:
    python scripts/seed_balanced_psychometric.py

Safe to re-run: clears existing questions and session assignments first.
"""
import asyncio
import sys
import random

app_dir = r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api"
sys.path.append(app_dir)

from app.core.database import AsyncSessionLocal
from app.models.models import (
    InterviewSession,
    PsychometricQuestion,
    SessionPsychometricQuestion
)
from sqlalchemy import select, delete

# ── 20 Balanced Psychometric Questions ────────────────────────────────────────
# ideal_response:
#   "SA" → Strongly Agree is the healthy/positive answer
#   "SD" → Strongly Disagree is the healthy/positive answer (reverse-scored)
#   "N"  → Neutral is the anchored/expected honest response
#
BALANCED_PSYCHOMETRIC_DATA = [

    # ── Adaptability (SA × 2, SD × 1) ─────────────────────────────────
    {"trait": "Adaptability", "ideal_response": "SA",
     "statement_text": "When project plans change suddenly due to client needs, I easily adjust my daily tasks without losing focus."},
    {"trait": "Adaptability", "ideal_response": "SA",
     "statement_text": "I feel excited when learning new tools or software to solve a work problem."},
    # Reverse-scored (1/7): preferring rigid familiar tools
    {"trait": "Adaptability", "ideal_response": "SD",
     "statement_text": "I strongly prefer sticking with tools and processes I already know rather than switching to new approaches mid-project."},

    # ── Resilience (SA × 2, SD × 2) ───────────────────────────────────
    {"trait": "Resilience", "ideal_response": "SA",
     "statement_text": "When my work has mistakes or needs rework, I take the feedback positively and improve it right away."},
    {"trait": "Resilience", "ideal_response": "SA",
     "statement_text": "Under tight deadlines or difficult technical issues, I stay calm and focus on practical solutions."},
    # Reverse-scored (2/7): dwelling on minor defects
    {"trait": "Resilience", "ideal_response": "SD",
     "statement_text": "When an unexpected bug or failure occurs in my module, I get discouraged and find it difficult to regain productive momentum."},
    # Reverse-scored (3/7): defensive reaction to review comments
    {"trait": "Resilience", "ideal_response": "SD",
     "statement_text": "I feel upset and personally hurt when senior teammates point out mistakes or ask for major changes in my work."},

    # ── Collaboration (SA × 1, SD × 2) ────────────────────────────────
    {"trait": "Collaboration", "ideal_response": "SA",
     "statement_text": "I actively share helpful notes and guides with teammates to help them succeed, even when I am busy."},
    # Reverse-scored (4/7): isolating from teammates
    {"trait": "Collaboration", "ideal_response": "SD",
     "statement_text": "I find it annoying when teammates ask questions about my work, because it slows down my personal speed."},
    # Reverse-scored (5/7): reluctant to help teammates outside primary scope
    {"trait": "Collaboration", "ideal_response": "SD",
     "statement_text": "I prefer to concentrate only on my own tasks and avoid helping out when team members are struggling with theirs."},

    # ── Conscientiousness (SA × 2, SD × 1) ────────────────────────────
    {"trait": "Conscientiousness", "ideal_response": "SA",
     "statement_text": "I double-check my work carefully for mistakes before submitting it for review."},
    {"trait": "Conscientiousness", "ideal_response": "SA",
     "statement_text": "I strictly follow security rules, company guidelines, and quality standards in all my daily tasks."},
    # Reverse-scored (6/7): skipping tests/docs under time pressure
    {"trait": "Conscientiousness", "ideal_response": "SD",
     "statement_text": "When working under tight deadlines, I feel it is fine to skip checking my work or skip notes to finish faster."},

    # ── Growth Mindset (SA × 1, SD × 1) ───────────────────────────────
    {"trait": "Growth Mindset", "ideal_response": "SA",
     "statement_text": "I see difficult technical errors as helpful chances to learn and build my understanding."},
    # Reverse-scored (7/7): fixed mindset / avoiding asking for guidance
    {"trait": "Growth Mindset", "ideal_response": "SD",
     "statement_text": "I believe technical ability is something you are born with; people without natural talent rarely succeed even with training."},
]



async def seed_balanced_psychometric():
    async with AsyncSessionLocal() as session:
        print("Clearing existing psychometric assignments and questions...")
        await session.execute(delete(SessionPsychometricQuestion))
        await session.execute(delete(PsychometricQuestion))
        await session.commit()

        print("Seeding 15 balanced psychometric questions (8 SA, 7 SD)...")
        for item in BALANCED_PSYCHOMETRIC_DATA:
            pq = PsychometricQuestion(
                trait=item["trait"],
                statement_text=item["statement_text"],
                ideal_response=item["ideal_response"],
                is_active=True,
            )
            session.add(pq)
        await session.commit()

        res = await session.execute(select(PsychometricQuestion))
        all_pq = list(res.scalars().all())
        sa_count = sum(1 for q in all_pq if q.ideal_response == "SA")
        sd_count = sum(1 for q in all_pq if q.ideal_response == "SD")
        print(f"Seeded {len(all_pq)} questions — SA: {sa_count}, SD: {sd_count}")

        # Re-assign all 15 questions to existing sessions
        sess_res = await session.execute(select(InterviewSession))
        sessions = list(sess_res.scalars().all())

        total_assigned = 0
        for sess in sessions:
            selected = list(all_pq)
            random.shuffle(selected)

            for idx, q in enumerate(selected):
                session.add(SessionPsychometricQuestion(
                    session_id=sess.id,
                    psychometric_question_id=q.id,
                    order_index=idx + 1
                ))
                total_assigned += 1

        await session.commit()
        print(f"Re-assigned {total_assigned} questions across {len(sessions)} existing sessions.")
        print("Done.")


if __name__ == "__main__":
    asyncio.run(seed_balanced_psychometric())