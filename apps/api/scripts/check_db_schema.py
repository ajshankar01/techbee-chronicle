import asyncio
import sys

app_dir = r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api"
sys.path.append(app_dir)

from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'analysis_results'
            ORDER BY ordinal_position;
        """))
        cols = [r[0] for r in res.fetchall()]
        print("Columns in analysis_results:", cols)

if __name__ == "__main__":
    asyncio.run(main())
