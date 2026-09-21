import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT question_type, COUNT(*) FROM question_bank GROUP BY question_type"))
        rows = res.fetchall()
        for r in rows:
            print(f"{r[0]}: {r[1]}")

if __name__ == "__main__":
    asyncio.run(main())
