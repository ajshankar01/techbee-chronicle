"""
Analysis Router — AI behavioral and response analysis endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser, require_hr
from app.models.models import InterviewSession, AnalysisResult, InterviewReport, Candidate
from app.services.gemini_service import analyze_full_interview
from app.services.pdf_service import generate_pdf_report
from app.services.storage_service import upload_report_pdf

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("/trigger/{session_id}")
async def trigger_analysis(
    session_id: str,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger AI analysis for a completed session."""
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == uuid.UUID(session_id))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    background_tasks.add_task(_run_analysis_job, session_id, db)
    return {"success": True, "message": "Analysis triggered"}


@router.get("/{session_id}")
async def get_analysis(
    session_id: str,
    current_user: CurrentUser = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Returns analysis result for a given session."""
    result = await db.execute(
        select(AnalysisResult).where(
            AnalysisResult.session_id == uuid.UUID(session_id)
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not ready yet")

    behavioral_summary = {
        "eye_contact_avg": analysis.eye_contact_score or 0.0,
        "body_language_score": analysis.body_language_score or 0.0,
        "facial_expression_score": analysis.facial_expression_score or 0.0,
        "hand_gesture_score": analysis.hand_gesture_score or 0.0,
        "posture_score": analysis.posture_score or 0.0,
    }

    return {
        "session_id": session_id,
        "overall_score": analysis.overall_score,
        "scores": {
            "vision_alignment": analysis.vision_alignment_score,
            "emotional_intelligence": analysis.emotional_intelligence_score,
            "stress_tolerance": analysis.stress_tolerance_score,
            "adaptability": analysis.adaptability_score,
            "team_collaboration": analysis.team_collaboration_score,
            "ethical_decision_making": analysis.ethical_decision_making_score,
            "eye_contact": analysis.eye_contact_score,
            "body_language": analysis.body_language_score,
        },
        "mindset_label": analysis.mindset_label,
        "ethical_decision_making_label": analysis.ethical_decision_making_label,
        "domain_recommendation": analysis.domain_recommendation,
        "secondary_domain": analysis.secondary_domain,
        "summary_text": analysis.summary_text,
        "strengths": analysis.strengths or [],
        "areas_of_improvement": analysis.areas_of_improvement or [],
        "red_flags": analysis.red_flags or [],
        "behavioral_summary": behavioral_summary,
        # Extended fields from advanced JSON columns
        "per_question_analysis": (analysis.per_question_analysis_json or {}).get("per_question_analysis", []),
        "transcript_keyword_map": (analysis.per_question_analysis_json or {}).get("transcript_keyword_map", {}),
        "fit_verdict": (analysis.advanced_report_json or {}).get("fit_verdict", "Conditionally Recommended"),
        "fit_verdict_reason": (analysis.advanced_report_json or {}).get("fit_verdict_reason", ""),
        "executive_summary": (analysis.advanced_report_json or {}).get("executive_summary", analysis.summary_text or ""),
        "hr_action_plan": (analysis.advanced_report_json or {}).get("hr_action_plan", []),
        "candidate_archetype": (analysis.advanced_report_json or {}).get("candidate_archetype", ""),
        "archetype_description": (analysis.advanced_report_json or {}).get("archetype_description", ""),
        "retention_risk": (analysis.advanced_report_json or {}).get("retention_risk", "Low"),
        "evasion_score": (analysis.advanced_behavioral_json or {}).get("evasion_score", 0),
        "tone_map": (analysis.advanced_behavioral_json or {}).get("tone_map", []),
    }


@router.get("/{session_id}/behavioral")
async def get_behavioral_analysis(
    session_id: str,
    current_user: CurrentUser = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalysisResult).where(
            AnalysisResult.session_id == uuid.UUID(session_id)
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    behavioral_summary = {
        "eye_contact_avg": analysis.eye_contact_score or 0.0,
        "body_language_score": analysis.body_language_score or 0.0,
        "facial_expression_score": analysis.facial_expression_score or 0.0,
        "hand_gesture_score": analysis.hand_gesture_score or 0.0,
        "posture_score": analysis.posture_score or 0.0,
    }

    return {
        "session_id": session_id,
        "behavioral_summary": behavioral_summary,
        "eye_contact_score": analysis.eye_contact_score,
        "body_language_score": analysis.body_language_score,
    }


async def _run_analysis_job(session_id: str, db: AsyncSession):
    """Background task: run Gemini analysis + generate PDF report."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        from sqlalchemy import select as sql_select
        from app.models.models import CandidateResponse, InterviewQuestion

        # Collect all responses + questions for this session
        qr_result = await db.execute(
            sql_select(CandidateResponse, InterviewQuestion)
            .join(InterviewQuestion, CandidateResponse.question_id == InterviewQuestion.id)
            .where(CandidateResponse.session_id == uuid.UUID(session_id))
            .order_by(InterviewQuestion.order_index)
        )
        qna = [
            {
                "question": row.InterviewQuestion.question_text,
                "question_type": row.InterviewQuestion.question_type,
                "response": row.CandidateResponse.transcript_text or "",
                "response_duration_seconds": row.CandidateResponse.response_duration_seconds,
            }
            for row in qr_result
        ]

        # Candidate info
        sess_result = await db.execute(
            sql_select(InterviewSession, Candidate)
            .join(Candidate, InterviewSession.candidate_id == Candidate.id)
            .where(InterviewSession.id == uuid.UUID(session_id))
        )
        row = sess_result.first()
        if not row:
            return

        session_obj, candidate = row
        candidate_name = candidate.full_name
        candidate_email = candidate.email
        candidate_id = str(candidate.id)
        duration = (
            (session_obj.ended_at - session_obj.started_at).total_seconds() / 60
            if session_obj.started_at and session_obj.ended_at else 0
        )
        session_date = session_obj.started_at.strftime("%d %b %Y") if session_obj.started_at else "—"

        # Violations
        from app.models.models import ProctorViolation
        viol_result = await db.execute(
            sql_select(ProctorViolation).where(ProctorViolation.session_id == uuid.UUID(session_id))
        )
        violations = [
            {
                "type": v.violation_type,
                "at_seconds": v.session_timestamp_seconds,
                "details": v.details,
            }
            for v in viol_result.scalars()
        ]

        # Transcript (from all responses + questions interleaved)
        transcript = []
        for item in qna:
            transcript.append({"speaker": "aria", "text": item["question"], "question_type": item["question_type"], "timestamp": ""})
            if item["response"]:
                transcript.append({"speaker": "candidate", "text": item["response"], "question_type": item["question_type"], "timestamp": ""})

        # Run Gemini analysis
        analysis_result = await analyze_full_interview(
            session_id=session_id,
            candidate_name=candidate_name,
            questions_and_responses=qna,
            behavioral_data={},
        )

        # Save to DB
        existing = await db.execute(
            sql_select(AnalysisResult).where(
                AnalysisResult.session_id == uuid.UUID(session_id)
            )
        )
        analysis = existing.scalar_one_or_none()
        if not analysis:
            analysis = AnalysisResult(session_id=uuid.UUID(session_id))
            db.add(analysis)

        scores = analysis_result.get("scores", {})
        analysis.overall_score = analysis_result.get("overall_score")
        analysis.vision_alignment_score = scores.get("vision_alignment")
        analysis.emotional_intelligence_score = scores.get("emotional_intelligence")
        analysis.stress_tolerance_score = scores.get("stress_tolerance")
        analysis.adaptability_score = scores.get("adaptability")
        analysis.team_collaboration_score = scores.get("team_collaboration")
        analysis.ethical_decision_making_score = scores.get("ethical_decision_making")
        analysis.eye_contact_score = scores.get("eye_contact")
        analysis.body_language_score = scores.get("body_language")
        analysis.mindset_label = analysis_result.get("mindset_label")
        analysis.ethical_decision_making_label = analysis_result.get("ethical_decision_making_label")
        analysis.domain_recommendation = analysis_result.get("domain_recommendation")
        analysis.secondary_domain = analysis_result.get("secondary_domain")
        analysis.summary_text = analysis_result.get("summary_text")
        analysis.strengths = analysis_result.get("strengths", [])
        analysis.areas_of_improvement = analysis_result.get("areas_of_improvement", [])
        analysis.red_flags = analysis_result.get("red_flags", [])
        await db.commit()

        # Generate PDF report
        pdf_bytes = await generate_pdf_report(
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            session_id=session_id,
            session_date=session_date,
            duration_minutes=duration,
            analysis=analysis_result,
            transcript=transcript,
            violations=violations,
        )

        pdf_url = await upload_report_pdf(
            session_id=session_id,
            candidate_id=candidate_id,
            pdf_bytes=pdf_bytes,
        )

        report = InterviewReport(
            session_id=uuid.UUID(session_id),
            pdf_url=pdf_url,
        )
        db.add(report)
        await db.commit()
        logger.info(f"Analysis job complete for session {session_id}")

    except Exception as e:
        logger.error(f"Analysis job failed for {session_id}: {e}", exc_info=True)
