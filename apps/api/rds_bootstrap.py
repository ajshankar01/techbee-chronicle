"""
RDS Schema Bootstrap Script
Creates all tables on AWS RDS using SQLAlchemy create_all (no Alembic/psycopg2 needed).
Uses asyncpg directly — which is already installed and working.
"""
import asyncio
import ssl
import sys
import os

# Add app to path
sys.path.insert(0, os.path.dirname(__file__))

RDS_URL = "postgresql+asyncpg://chronicle_admin:Techbeechronicle%232026@techbee-interview-questions-db.cxoiosyc6jjf.ap-southeast-2.rds.amazonaws.com:5432/postgres"

async def create_all_tables():
    from sqlalchemy.ext.asyncio import create_async_engine

    # SSL context for RDS
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    engine = create_async_engine(
        RDS_URL,
        connect_args={"ssl": ssl_ctx},
        echo=True,
    )

    # Import all models so they register with Base.metadata
    print("[INFO] Importing models...")
    from app.models.models import (
        Base, Candidate, HRUser, QuestionBank, InterviewSession,
        InterviewQuestion, CandidateResponse, AnalysisResult, QuestionHistory
    )

    print("[INFO] Creating all tables on RDS...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("[SUCCESS] All tables created successfully on AWS RDS!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_all_tables())
