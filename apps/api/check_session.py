import asyncio
import sys
from app.core.database import AsyncSessionLocal
from app.models.models import InterviewSession, AnalysisResult, SessionStatus, Candidate
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AnalysisResult)
            .order_by(AnalysisResult.created_at.desc())
            .limit(5)
        )
        ars = result.scalars().all()
        for ar in ars:
            print(f"AR: Session {ar.session_id} - Created: {ar.created_at} - Score: {ar.overall_score}")

asyncio.run(main())
