import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, Base
from app.core.seeder import seed_question_bank
from app.core.database import AsyncSessionLocal

async def main():
    print("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("Seeding database...")
    async with AsyncSessionLocal() as db:
        await seed_question_bank(db)
    
    print("Database recreated and seeded successfully!")

if __name__ == "__main__":
    asyncio.run(main())
