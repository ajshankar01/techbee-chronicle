import urllib.request
import json

req = urllib.request.Request("http://127.0.0.1:8000/api/questions/bank")
# We need auth. Let's just bypass it or query DB
import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.core.database import AsyncSessionLocal
from app.models.models import QuestionBank
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(QuestionBank).limit(1))
        q = res.scalar_one_or_none()
        if q:
            print(f"DB Object question_type: {q.question_type}")
            print(f"Enum type: {type(q.question_type)}")
            print(f"Enum value: {q.question_type.value}")
            print(f"Enum name: {q.question_type.name}")

if __name__ == "__main__":
    asyncio.run(main())
