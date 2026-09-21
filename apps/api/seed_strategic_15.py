import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.models import QuestionBank, QuestionType
from sqlalchemy import select

async def main():
    questions = [
        "How do you align your daily engineering tasks with the long-term business goals of the company?",
        "Describe a time when you chose a technology stack not for its novelty, but for its strategic fit for the business.",
        "When faced with multiple high-priority features, how do you decide which one will deliver the most strategic value?",
        "Tell me about a time you identified a future risk in a project and mitigated it before it became a problem.",
        "How do you balance the need for rapid feature delivery against accumulating technical debt?",
        "If you were tasked with entering a new market, what technical considerations would drive your strategy?",
        "How do you ensure your team's roadmap aligns with the overall corporate vision?",
        "Give an example of a time you had to pivot a project's strategy due to changing market conditions.",
        "What metrics do you consider most important when measuring the strategic success of a software release?",
        "How do you foster a culture of strategic thinking and long-term planning within your team?",
        "Describe a situation where a short-term win would have negatively impacted long-term strategy. What did you do?",
        "How do you evaluate whether a new architectural trend is worth adopting strategically for your organization?",
        "Tell me about a time you had to persuade senior stakeholders to change their strategic direction based on technical reality.",
        "How do you factor in competitor movements when planning your product's technical roadmap?",
        "What is your framework for making build-vs-buy decisions for critical infrastructure?"
    ]
    
    async with AsyncSessionLocal() as db:
        for text in questions:
            res = await db.execute(select(QuestionBank).where(QuestionBank.question_text == text))
            if not res.scalar_one_or_none():
                qb = QuestionBank(
                    question_type=QuestionType.STRATEGIC_THINKING,
                    question_text=text,
                    tags={"seeded": True, "domain": "general", "bond_year": 3, "difficulty": "medium"}
                )
                db.add(qb)
        await db.commit()

if __name__ == "__main__":
    asyncio.run(main())
