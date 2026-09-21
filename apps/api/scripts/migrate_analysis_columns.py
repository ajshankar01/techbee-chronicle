import asyncio
import sys

app_dir = r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api"
sys.path.append(app_dir)

from app.core.database import AsyncSessionLocal
from sqlalchemy import text

COLUMNS_TO_ADD = [
    "ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS gross_speed FLOAT",
    "ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS accuracy FLOAT",
    "ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS throughput FLOAT",
    "ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS net_score FLOAT",
    "ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS cognitive_composite_score FLOAT",
    "ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS t_score FLOAT",
]

async def main():
    async with AsyncSessionLocal() as session:
        for stmt in COLUMNS_TO_ADD:
            print("Executing:", stmt)
            await session.execute(text(stmt))
        await session.commit()
        print("All columns added successfully.")

        res = await session.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'analysis_results'
            ORDER BY ordinal_position;
        """))
        cols = [r[0] for r in res.fetchall()]
        print("Updated columns:", cols)

if __name__ == "__main__":
    asyncio.run(main())
