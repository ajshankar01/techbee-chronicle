import asyncio
import os
import sys
import uuid
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.models import HRUser
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(HRUser.id).limit(1))
        hr_id = res.scalar_one_or_none()
        print(f"Valid HR user ID: {hr_id}")

if __name__ == "__main__":
    asyncio.run(main())
