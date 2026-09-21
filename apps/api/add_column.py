import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("ALTER TABLE analysis_results ADD COLUMN strategic_thinking_score FLOAT"))
            await db.commit()
            print("Added strategic_thinking_score to DB.")
        except Exception as e:
            print("Error or already exists:", e)

if __name__ == "__main__":
    asyncio.run(main())
