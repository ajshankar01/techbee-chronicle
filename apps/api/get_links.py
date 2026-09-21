import asyncio
import sys
import json
from app.core.database import AsyncSessionLocal
from app.models.models import InterviewSession, SessionStatus
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(InterviewSession).options(selectinload(InterviewSession.candidate)).filter(InterviewSession.status == SessionStatus.PENDING))
        sessions = result.scalars().all()
        print('\n=== PENDING INTERVIEW LINKS ===\n')
        for s in sessions:
            if s.candidate:
                meta = {}
                if s.notes:
                    try:
                        meta = json.loads(s.notes)
                    except:
                        pass
                token = meta.get('access_token', '')
                print(f'Candidate: {s.candidate.display_name} | Module: {s.bond_year} | Link: http://localhost:3000/interview?session={s.id}&token={token}\n')
        print('===============================')

asyncio.run(main())
