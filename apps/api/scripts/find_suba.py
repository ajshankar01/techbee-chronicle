import asyncio
import sys

app_dir = r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api"
sys.path.append(app_dir)

from app.core.database import AsyncSessionLocal
from app.models.models import InterviewSession, Candidate, AnalysisResult
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        res = await session.execute(
            select(Candidate, InterviewSession, AnalysisResult)
            .outerjoin(InterviewSession, Candidate.id == InterviewSession.candidate_id)
            .outerjoin(AnalysisResult, InterviewSession.id == AnalysisResult.session_id)
            .where(Candidate.display_name.ilike("%suba%") | Candidate.email.ilike("%suba%"))
        )
        rows = res.all()
        print(f"Found {len(rows)} matching Suba:")
        for cand, isess, ar in rows:
            sid = isess.id if isess else "No session"
            st = isess.status if isess else "N/A"
            video = isess.video_recording_url if isess else "None"
            notes = isess.notes if isess else ""
            ar_id = ar.id if ar else "No AnalysisResult"
            print(f"Candidate: {cand.display_name} ({cand.email}, SAP: {cand.employee_id}) | Session: {sid} | Status: {st} | Video: {video} | AR: {ar_id}")
            if notes:
                print(f"Notes: {notes[:200]}")

if __name__ == "__main__":
    asyncio.run(main())
