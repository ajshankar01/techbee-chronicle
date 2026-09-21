import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        await db.execute(text("UPDATE question_bank SET question_type = 'FORENSIC_ANALYSIS' WHERE question_type = 'MURDER_SOLVING'"))
        await db.execute(text("UPDATE session_questions SET question_type = 'FORENSIC_ANALYSIS' WHERE question_type = 'MURDER_SOLVING'"))
        await db.commit()
        print("Updated MURDER_SOLVING to FORENSIC_ANALYSIS in db tables.")

if __name__ == "__main__":
    asyncio.run(main())
