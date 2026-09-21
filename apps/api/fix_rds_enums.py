import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    print("Fixing enum values in PostgreSQL...")
    async with AsyncSessionLocal() as db:
        new_values = [
            'PSYCHOMETRIC',
            'ENDURANCE',
            'COGNITIVE_ABILITY',
            'MURDER_SOLVING',
            'FORENSIC_ANALYSIS',
            'ADAPTABILITY',
            'COMMUNICATION',
            'TEAM_MANAGEMENT',
            'LEADERSHIP_QUALITY',
            'VISION_AND_MISSION',
            'FOLLOWUP'
        ]
        
        for val in new_values:
            try:
                await db.execute(text(f"ALTER TYPE questiontype ADD VALUE IF NOT EXISTS '{val}'"))
                await db.commit()
                print(f"Added {val} to enum.")
            except Exception as e:
                # If it already exists, postgres might throw an error or warning, just ignore
                await db.rollback()
                pass
        
        print("Enum values updated successfully.")

if __name__ == "__main__":
    asyncio.run(main())
