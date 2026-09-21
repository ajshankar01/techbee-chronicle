import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'STRATEGIC_THINKING'"))
            await db.commit()
            print("Added STRATEGIC_THINKING to enum.")
        except Exception as e:
            print("Error or already exists:", e)

if __name__ == "__main__":
    asyncio.run(main())
