import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DATABASE_URL")
engine = create_async_engine(db_url)

async def execute_safe(sql):
    try:
        async with engine.begin() as conn:
            await conn.execute(text(sql))
        print(f"Executed: {sql}")
    except Exception as e:
        print(f"Failed: {sql} - {e}")

async def main():
    await execute_safe("CREATE TYPE questiondifficulty AS ENUM ('EASY', 'MEDIUM', 'HARD')")
    await execute_safe("CREATE TYPE questionstatus AS ENUM ('DRAFT', 'AI_VALIDATED', 'HUMAN_REVIEW', 'PILOT', 'ACTIVE', 'MONITORED', 'RETIRED')")
    await execute_safe("ALTER TYPE cognitivedomain ADD VALUE IF NOT EXISTS 'PATTERN'")
    await execute_safe("ALTER TYPE cognitivedomain ADD VALUE IF NOT EXISTS 'PROCESSING'")
    await execute_safe("ALTER TYPE cognitivedomain ADD VALUE IF NOT EXISTS 'ATTENTION'")
    await execute_safe("ALTER TYPE cognitivedomain ADD VALUE IF NOT EXISTS 'ABSTRACT'")

    columns = [
        "ALTER TABLE cognitive_questions ADD COLUMN IF NOT EXISTS subcategory VARCHAR(255)",
        "ALTER TABLE cognitive_questions ADD COLUMN IF NOT EXISTS difficulty questiondifficulty DEFAULT 'MEDIUM'",
        "ALTER TABLE cognitive_questions ADD COLUMN IF NOT EXISTS explanation TEXT",
        "ALTER TABLE cognitive_questions ADD COLUMN IF NOT EXISTS template_id VARCHAR(128)",
        "ALTER TABLE cognitive_questions ADD COLUMN IF NOT EXISTS status questionstatus DEFAULT 'ACTIVE'",
        "ALTER TABLE cognitive_questions ADD COLUMN IF NOT EXISTS estimated_time INTEGER DEFAULT 60",
        "ALTER TABLE cognitive_questions ADD COLUMN IF NOT EXISTS exposure_count INTEGER DEFAULT 0",
        "ALTER TABLE cognitive_questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
        "ALTER TABLE cognitive_questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"
    ]
    
    for col in columns:
        await execute_safe(col)
                
    print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(main())
