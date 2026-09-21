"""
HR Router — Dashboard data, candidate management, session oversight
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.auth import get_current_hr_user
from app.models.models import (
    InterviewSession, Candidate, AnalysisResult, InterviewReport,
    ProctoringViolation, SessionStatus, HRUser
)

router = APIRouter()


@router.get("/dashboard", summary="HR Dashboard summary stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    """Returns key metrics for the HR dashboard overview."""
    # Total sessions
    total = await db.execute(select(func.count(InterviewSession.id)))
    total_count = total.scalar()

    # By status
    completed = await db.execute(
        select(func.count(InterviewSession.id)).where(InterviewSession.status == SessionStatus.COMPLETED)
    )
    pending = await db.execute(
        select(func.count(InterviewSession.id)).where(InterviewSession.status == SessionStatus.PENDING)
    )
    active = await db.execute(
        select(func.count(InterviewSession.id)).where(InterviewSession.status == SessionStatus.ACTIVE)
    )

    return {
        "total_sessions": total_count,
        "completed": completed.scalar(),
        "pending": pending.scalar(),
        "active_now": active.scalar(),
    }


@router.get("/candidates", summary="List all candidates")
async def list_candidates(
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    result = await db.execute(select(Candidate).order_by(Candidate.created_at.desc()))
    candidates = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "name": c.display_name,
            "display_name": c.display_name,
            "email": c.email,
            "batch_year": c.batch_year,
            "employee_id": c.employee_id,
            "is_active": c.is_active,
            "join_date": c.join_date.strftime("%d %b %Y") if c.join_date else None,
            "current_bond_year": c.calculated_bond_year,
            "current_module": f"Module {c.calculated_bond_year}",
        }
        for c in candidates
    ]


@router.get("/candidates/search", summary="Search candidates by name or email")
async def search_candidates(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    query = select(Candidate).where(
        (Candidate.display_name.ilike(f"%{q}%")) | (Candidate.email.ilike(f"%{q}%"))
    )
    result = await db.execute(query)
    candidates = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "full_name": c.display_name or c.email,
            "email": c.email,
            "status": "available" if c.is_active else "inactive",
            "bond_year": c.calculated_bond_year,
            "current_module": f"Module {c.calculated_bond_year}",
            "join_date": c.join_date.strftime("%d %b %Y") if c.join_date else None,
        }
        for c in candidates
    ]


@router.get("/report/{session_id}", summary="Get full interview report (HR only)")
async def get_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    """Returns the complete interview report with analysis, transcript, and violations."""
    session_uuid = uuid.UUID(session_id)

    # Session
    s_result = await db.execute(select(InterviewSession).where(InterviewSession.id == session_uuid))
    session = s_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Candidate
    c_result = await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
    candidate = c_result.scalar_one()

    # Analysis
    a_result = await db.execute(select(AnalysisResult).where(AnalysisResult.session_id == session_uuid))
    analysis = a_result.scalar_one_or_none()

    # Report
    r_result = await db.execute(select(InterviewReport).where(InterviewReport.session_id == session_uuid))
    report = r_result.scalar_one_or_none()

    # Violations
    v_result = await db.execute(
        select(ProctoringViolation).where(ProctoringViolation.session_id == session_uuid)
        .order_by(ProctoringViolation.occurred_at)
    )
    violations = v_result.scalars().all()

    return {
        "session": {
            "id": session_id,
            "status": session.status.value,
            "started_at": session.started_at,
            "ended_at": session.ended_at,
            "duration_seconds": session.duration_seconds,
            "video_recording_url": session.video_recording_url,
        },
        "candidate": {
            "id": str(candidate.id),
            "name": candidate.display_name,
            "email": candidate.email,
            "batch_year": candidate.batch_year,
        },
        "analysis": {
            "overall_score": analysis.overall_score if analysis else None,
            "mindset_label": analysis.mindset_label if analysis else None,
            "ethical_decision_making_label": analysis.ethical_decision_making_label if analysis else None,
            "domain_recommendation": analysis.domain_recommendation if analysis else None,
            "secondary_domain": analysis.secondary_domain if analysis else None,
            "scores": {
                "vision_alignment": analysis.vision_alignment_score,
                "emotional_intelligence": analysis.emotional_intelligence_score,
                "stress_tolerance": analysis.stress_tolerance_score,
                "adaptability": analysis.adaptability_score,
                "team_collaboration": analysis.team_collaboration_score,
                "ethical_decision_making": analysis.ethical_decision_making_score,
                "eye_contact": analysis.eye_contact_score,
                "body_language": analysis.body_language_score,
            } if analysis else None,
            "summary_text": analysis.summary_text if analysis else None,
            "strengths": analysis.strengths if analysis else [],
            "areas_of_improvement": analysis.areas_of_improvement if analysis else [],
            "red_flags": analysis.red_flags if analysis else [],
            "per_question_analysis": analysis.per_question_analysis_json if analysis else None,
            "profile_snapshot": analysis.profile_snapshot if analysis else None,
            "longitudinal_trends": analysis.longitudinal_trends if analysis else None,
            # Advanced Intelligence fields (A–D)
            "advanced_behavioral": analysis.advanced_behavioral_json if analysis else None,
            "advanced_longitudinal": analysis.advanced_longitudinal_json if analysis else None,
            "advanced_psychological": analysis.advanced_psychological_json if analysis else None,
            "advanced_report": analysis.advanced_report_json if analysis else None,
        },
        "transcript": report.full_transcript_json if report else [],
        "violations": [
            {
                "type": v.violation_type.value,
                "at_seconds": v.session_timestamp_seconds,
                "details": v.details,
            }
            for v in violations
        ],
        "pdf_url": report.pdf_url if report else None,
    }



from pydantic import BaseModel
from typing import Optional
import random

class CreateCandidateRequest(BaseModel):
    display_name: str
    email: str
    batch_year: Optional[int] = 2026
    employee_id: Optional[str] = None

@router.post("/candidates", summary="Create/Register a new candidate")
async def create_candidate(
    body: CreateCandidateRequest,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    # Check if candidate already exists by email
    result = await db.execute(select(Candidate).where(Candidate.email == body.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Candidate already exists")

    # Generate a dummy azure_oid (e.g. random uuid) since it's unique/indexed
    dummy_oid = f"oid_{uuid.uuid4()}"
    emp_id = body.employee_id or f"SAP{random.randint(100000, 999999)}"
    
    candidate = Candidate(
        azure_oid=dummy_oid,
        display_name=body.display_name,
        email=body.email,
        batch_year=body.batch_year,
        employee_id=emp_id,
        is_active=True,
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    
    return {
        "id": str(candidate.id),
        "full_name": candidate.display_name,
        "email": candidate.email,
        "employee_id": candidate.employee_id,
        "status": "available",
    }
