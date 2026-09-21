import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    print("Fixing enum values in PostgreSQL...")
    async with AsyncSessionLocal() as db:
        # PostgreSQL Enums are strongly typed. We might need to ALTER TYPE or cast it.
        # But wait, in the models.py we used SQLAlchemy's Enum.
        # If SQLAlchemy created it as a VARCHAR, we can just update it.
        # If it created a native ENUM, it's harder.
        # Let's try direct update first. If it's a native enum, we need to alter type.
        
        # Check if questiontype enum exists
        result = await db.execute(text("SELECT typname FROM pg_type WHERE typname = 'questiontype'"))
        rows = result.fetchall()
        
        if rows:
            print("Native enum 'questiontype' found. Adding new value...")
            try:
                await db.execute(text("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'COGNITIVE_ABILITY'"))
                await db.commit()
                print("Added COGNITIVE_ABILITY to enum.")
            except Exception as e:
                print(f"Enum alter error: {e}")
                
            print("Updating tables to use COGNITIVE_ABILITY instead of COGNITIVE...")
            try:
                await db.execute(text("UPDATE question_bank SET question_type = 'COGNITIVE_ABILITY' WHERE question_type = 'COGNITIVE'"))
                await db.execute(text("UPDATE session_questions SET question_type = 'COGNITIVE_ABILITY' WHERE question_type = 'COGNITIVE'"))
                await db.commit()
                print("Update successful.")
            except Exception as e:
                print(f"Update error: {e}")
        else:
            print("No native enum found, assuming VARCHAR.")
            await db.execute(text("UPDATE question_bank SET question_type = 'COGNITIVE_ABILITY' WHERE question_type = 'COGNITIVE'"))
            await db.execute(text("UPDATE session_questions SET question_type = 'COGNITIVE_ABILITY' WHERE question_type = 'COGNITIVE'"))
            await db.commit()
            print("Update successful.")

if __name__ == "__main__":
    asyncio.run(main())
