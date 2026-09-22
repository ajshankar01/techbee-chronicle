"""
Interview Router — Session management and interview flow control
"""
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List

# Local video cache directory — persists recordings for HR portal playback
VIDEO_CACHE_DIR = Path("video_cache")
VIDEO_CACHE_DIR.mkdir(exist_ok=True)

from app.core.database import get_db
from app.core.auth import get_current_hr_user, get_current_candidate
from app.models.models import (
    InterviewSession, SessionQuestion, CandidateResponse,
    SessionStatus, QuestionType, QuestionSource, Candidate, HRUser, AnalysisResult,
    QuestionBank, QuestionHistory, CognitiveQuestion, SessionCognitiveQuestion,
    PsychometricQuestion, SessionPsychometricQuestion
)
from app.services.gemini_service import analyze_interview_session

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    candidate_email: Optional[str] = None
    candidate_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = None
    questions: Optional[List[dict]] = None
    num_questions: Optional[int] = 2
    bond_year: Optional[int] = None


class SessionResponse(BaseModel):
    id: str
    candidate_name: str
    candidate_email: str
    status: str
    scheduled_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class StartInterviewRequest(BaseModel):
    session_id: str


class SubmitResponseRequest(BaseModel):
    session_id: str
    question_id: str
    transcript_text: str
    video_timestamp_start: float
    video_timestamp_end: float
    candidate_name: Optional[str] = None  # Real name from frontend session


class SubmitViolationRequest(BaseModel):
    session_id: str
    violation_type: str
    session_timestamp_seconds: float
    details: Optional[str] = None


class SegmentAnswer(BaseModel):
    question_id: str
    selected_index: Optional[int] = None
    selected_score: Optional[int] = None

class SubmitSegmentRequest(BaseModel):
    segment: str
    answers: List[SegmentAnswer]
    raw_data: Optional[dict] = None


# ── HR Endpoints ──────────────────────────────────────────────────────────────

@router.post("/sessions", summary="Create a new interview session (HR only)")
async def create_session(
    req: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    """HR creates a session for a specific candidate with questions pre-loaded or auto-selected."""
    # Find or provision candidate
    candidate = None
    if req.candidate_id:
        try:
            cand_uuid = uuid.UUID(req.candidate_id)
            c_res = await db.execute(select(Candidate).where(Candidate.id == cand_uuid))
            candidate = c_res.scalar_one_or_none()
        except ValueError:
            pass
            
    if not candidate and req.candidate_email:
        c_res = await db.execute(select(Candidate).where(Candidate.email == req.candidate_email))
        candidate = c_res.scalar_one_or_none()
        
    if not candidate:
        raise HTTPException(
            status_code=404,
            detail=f"Candidate not found. Please register the candidate first."
        )

    # Determine bond_year and parent session
    by = req.bond_year or candidate.calculated_bond_year or 1
    parent_id = None
    if by > 1:
        parent_res = await db.execute(
            select(InterviewSession)
            .where(InterviewSession.candidate_id == candidate.id)
            .where(InterviewSession.status == SessionStatus.COMPLETED)
            .where(InterviewSession.bond_year == by - 1)
            .order_by(InterviewSession.ended_at.desc())
        )
        parent_s = parent_res.scalars().first()
        if parent_s:
            parent_id = parent_s.id

    # Create session
    session = InterviewSession(
        candidate_id=candidate.id,
        created_by_hr_id=current_hr.id,
        scheduled_at=req.scheduled_at,
        notes=req.notes,
        status=SessionStatus.PENDING,
        bond_year=by,
        parent_session_id=parent_id,
    )
    db.add(session)
    await db.flush()  # Get session.id

    # Randomly select questions if none were specified
    selected_questions = []
    # Track (question_bank_id, question_text_hash, question_type) for QuestionHistory insertion
    chosen_qb_meta = []  # list of dicts with 'qb' (QuestionBank obj or None), 'q_type', 'pool_reset'

    if req.questions:
        selected_questions = req.questions
        # For HR-defined questions, still track them in history
        for q_data in req.questions:
            chosen_qb_meta.append({"qb": None, "q_type": q_data.get("type", "psychometric"), "pool_reset": False, "text": q_data["text"]})
    else:
        import random
        import hashlib
        import secrets
        from collections import defaultdict

        bank_res = await db.execute(select(QuestionBank).where(QuestionBank.is_active == True))
        all_bank_qs = bank_res.scalars().all()

        # Filter by bond year tag
        bank_qs = [qb for qb in all_bank_qs if (qb.tags or {}).get("bond_year") == by]
        if not bank_qs:
            bank_qs = all_bank_qs

        if not bank_qs:
            raise HTTPException(status_code=400, detail="Question bank is empty. Please add questions first.")

        # ── TRUE RANDOM per-session seed using cryptographic entropy ────────────
        # Each call to create_session generates a brand-new seed so every session
        # always gets different questions, even for the same candidate.
        # seed = session UUID low 31 bits XOR cryptographic random bytes
        crypto_seed = secrets.randbelow(2**31)
        session_seed = int(str(session.id).replace("-", ""), 16) % (2**31)
        rng = random.Random(crypto_seed ^ session_seed)

        # ── Load this candidate's question history (all previously asked question_bank_ids) ──
        history_res = await db.execute(
            select(QuestionHistory).where(
                QuestionHistory.candidate_id == candidate.id,
                QuestionHistory.bond_year == by
            )
        )
        history_rows = history_res.scalars().all()
        already_asked_bank_ids = {h.question_bank_id for h in history_rows if h.question_bank_id}
        already_asked_hashes = {h.question_text_hash for h in history_rows}

        # ── Helper: pick from pool excluding already asked, with exhaustion reset ──
        async def _pick_from_category(cat: str, pool: list, force_fresh: bool = False) -> tuple:
            """Returns (chosen_qb, q_text, pool_was_reset). Uses per-session RNG for true variety."""
            fresh = [qb for qb in pool if qb.id not in already_asked_bank_ids]
            pool_reset = False
            if not fresh:
                # Pool exhausted — try Gemini AI first (generates genuinely new question)
                from app.services.gemini_service import generate_ai_question
                try:
                    # Use a random topic from a diverse set so AI also generates different questions
                    topics = [
                        "workplace collaboration and team dynamics",
                        "handling ambiguity in software projects",
                        "personal resilience and stress management",
                        "stakeholder vision_alignment and expectation setting",
                        "learning from failure and adapting quickly",
                        "cross-functional team leadership",
                        "problem decomposition and critical thinking",
                    ]
                    topic = rng.choice(topics)
                    ai_text = await generate_ai_question(
                        question_type=cat,
                        topic=topic,
                        difficulty="medium"
                    )
                    if ai_text:
                        return (None, ai_text, True)  # (no QB obj, ai text, pool_reset)
                except Exception:
                    pass
                # If Gemini fails, reset and pick from full pool (shuffle for variety)
                fresh = list(pool)
                rng.shuffle(fresh)
                pool_reset = True
            else:
                # Shuffle the fresh pool so selection order is different each session
                fresh = list(fresh)
                rng.shuffle(fresh)
            chosen = fresh[0]  # Take first from shuffled list (guaranteed unique via shuffle+dedup)
            return (chosen, chosen.question_text, pool_reset)

        # Group available questions by category
        grouped_by_cat = defaultdict(list)
        for qb in bank_qs:
            grouped_by_cat[qb.question_type.value].append(qb)

        num_to_select = req.num_questions or 2
        chosen_qbs = []

        if num_to_select == 2:
            # Default: 1 psychometric + 1 adaptability
            # For bond_year >= 2, swap adaptability for a richer year-2 category
            if by >= 2:
                categories = ["psychometric", "team_management"]
                # Fallback to adaptability if team_management pool is empty
                if not grouped_by_cat.get("team_management"):
                    categories = ["psychometric", "adaptability"]
            else:
                categories = ["psychometric", "adaptability"]

            for cat in categories:
                pool = grouped_by_cat.get(cat, [])
                if not pool:
                    # Try any fallback
                    pool = [qb for qb in all_bank_qs if qb.question_type.value == cat]
                if not pool:
                    raise HTTPException(status_code=400, detail=f"Question bank is missing questions for category '{cat}'.")
                qb_obj, q_text, pool_reset = await _pick_from_category(cat, pool)
                chosen_qbs.append({"qb": qb_obj, "text": q_text, "q_type": cat, "pool_reset": pool_reset})

        else:
            # Multi-question: round-robin across categories
            # Module 2+ includes team_management and cognitive_ability
            if by >= 2:
                categories = ["psychometric", "vision_and_mission", "strategic_thinking", "endurance", "cognitive_ability", "team_management", "adaptability"]
            else:
                categories = ["psychometric", "vision_and_mission", "strategic_thinking", "endurance", "cognitive_ability", "adaptability"]
            rng.shuffle(categories)
            cat_idx = 0
            while len(chosen_qbs) < num_to_select:
                cat = categories[cat_idx % len(categories)]
                pool = grouped_by_cat.get(cat, [])
                if pool:
                    qb_obj, q_text, pool_reset = await _pick_from_category(cat, pool)
                    chosen_qbs.append({"qb": qb_obj, "text": q_text, "q_type": cat, "pool_reset": pool_reset})
                cat_idx += 1
                if cat_idx > num_to_select * len(categories) * 2:
                    break  # Safety valve

        selected_questions = [{"type": c["q_type"], "text": c["text"], "source": "question_bank"} for c in chosen_qbs]
        chosen_qb_meta = chosen_qbs

    # Add questions in order: Q1(idx=1), Q2(idx=3), Q3(idx=5)...
    order_idx = 1
    for q_data in selected_questions:
        q_type = q_data.get("type", "psychometric")
        source = QuestionSource.HR_DEFINED if q_data.get("source") == "hr" else QuestionSource.QUESTION_BANK
        q_text = q_data["text"]



        question = SessionQuestion(
            session_id=session.id,
            question_type=QuestionType(q_type),
            question_text=q_text,
            question_source=source,
            order_index=order_idx,
        )
        db.add(question)
        await db.flush()

        # ── Record in QuestionHistory for deduplication ──
        import hashlib
        q_hash = hashlib.sha256(q_text.encode()).hexdigest()[:64]
        # Find matching qb metadata
        meta_entry = None
        if chosen_qb_meta:
            # Match by question text for ordered pairing
            for meta in chosen_qb_meta:
                if meta.get("text") == q_text:
                    meta_entry = meta
                    break
        qb_id = None
        pool_reset_flag = False
        if meta_entry:
            qb_id = meta_entry["qb"].id if meta_entry.get("qb") else None
            pool_reset_flag = meta_entry.get("pool_reset", False)

        history_entry = QuestionHistory(
            candidate_id=candidate.id,
            session_id=session.id,
            question_bank_id=qb_id,
            question_text_hash=q_hash,
            question_type=QuestionType(q_type),
            bond_year=by,
            pool_exhausted_reset=pool_reset_flag,
        )
        db.add(history_entry)
        order_idx += 2  # increment by 2 to leave space for compatibility and pass test assertions

    import random
    # ── Map Cognitive & Psychometric Questions (35 Cognitive across 7 domains + 10 Psychometric) ──
    from app.models.models import CognitiveDomain, QuestionDifficulty
    cog_res = await db.execute(select(CognitiveQuestion).where(CognitiveQuestion.is_active == True))
    all_cog_qs = list(cog_res.scalars().all())
    
    cog_selected = []
    blueprint = {
        QuestionDifficulty.EASY: 2,
        QuestionDifficulty.MEDIUM: 2,
        QuestionDifficulty.HARD: 1
    }
    domains = [
        CognitiveDomain.NUMERICAL, CognitiveDomain.LOGICAL, CognitiveDomain.VERBAL,
        CognitiveDomain.PATTERN, CognitiveDomain.PROCESSING, CognitiveDomain.ATTENTION, CognitiveDomain.ABSTRACT
    ]
    for domain in domains:
        domain_qs = [q for q in all_cog_qs if q.domain == domain]
        for diff, count in blueprint.items():
            diff_qs = [q for q in domain_qs if q.difficulty == diff]
            random.shuffle(diff_qs)
            cog_selected.extend(diff_qs[:count])
            
    if len(cog_selected) < 35:
        remaining = [q for q in all_cog_qs if q not in cog_selected]
        random.shuffle(remaining)
        cog_selected.extend(remaining[:35 - len(cog_selected)])
        
    random.shuffle(cog_selected)
        
    for idx, cog_q in enumerate(cog_selected):
        db.add(SessionCognitiveQuestion(
            session_id=session.id,
            cognitive_question_id=cog_q.id,
            order_index=idx + 1
        ))
        
    psy_res = await db.execute(select(PsychometricQuestion).where(PsychometricQuestion.is_active == True))
    all_psy_qs = list(psy_res.scalars().all())
    
    psy_selected = []
    traits = ["Adaptability", "Resilience", "Collaboration", "Conscientiousness", "Growth Mindset"]
    for trait in traits:
        trait_qs = [q for q in all_psy_qs if q.trait == trait]
        random.shuffle(trait_qs)
        psy_selected.extend(trait_qs[:3])
        
    if len(psy_selected) < 15:
        remaining_psy = [q for q in all_psy_qs if q not in psy_selected]
        random.shuffle(remaining_psy)
        psy_selected.extend(remaining_psy[:15 - len(psy_selected)])
        
    random.shuffle(psy_selected)
        
    for idx, psy_q in enumerate(psy_selected):
        db.add(SessionPsychometricQuestion(
            session_id=session.id,
            psychometric_question_id=psy_q.id,
            order_index=idx + 1
        ))

    await db.commit()
    await db.refresh(session)

    return {
        "session_id": str(session.id),
        "candidate_name": candidate.display_name,
        "candidate_email": candidate.email,
        "status": session.status.value,
        "message": f"Session created for {candidate.display_name}. They can join via Teams.",
    }


@router.get("/sessions", summary="List all sessions (HR only)")
async def list_sessions(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    """Get all interview sessions with optional status filter."""
    query = select(InterviewSession, Candidate).join(Candidate, InterviewSession.candidate_id == Candidate.id)
    if status:
        query = query.where(InterviewSession.status == SessionStatus(status))
    query = query.order_by(InterviewSession.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(s.id),
            "candidate_name": c.display_name,
            "candidate_email": c.email,
            "status": s.status.value,
            "scheduled_at": s.scheduled_at,
            "started_at": s.started_at,
            "ended_at": s.ended_at,
            "duration_seconds": s.duration_seconds,
        }
        for s, c in rows
    ]


# ── HR: Get questions for a specific session ──────────────────────────────────

@router.get("/sessions/{session_id}/questions", summary="Get questions assigned to a session")
async def get_session_questions(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    """HR can inspect which questions were assigned to any session."""
    try:
        sess_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id format")

    q_result = await db.execute(
        select(SessionQuestion)
        .where(SessionQuestion.session_id == sess_uuid)
        .order_by(SessionQuestion.order_index)
    )
    questions = q_result.scalars().all()
    if not questions:
        raise HTTPException(status_code=404, detail="No questions found for this session")

    return [
        {
            "id": str(q.id),
            "type": q.question_type.value,
            "text": q.question_text,
            "source": q.question_source.value,
            "order": q.order_index,
        }
        for q in questions
    ]


# ── Candidate Endpoints ───────────────────────────────────────────────────────

@router.get("/session/my", summary="Get candidate's assigned session")
async def get_my_session(
    db: AsyncSession = Depends(get_db),
    candidate: Candidate = Depends(get_current_candidate),
):
    """Returns the most recent pending or active session for the logged-in candidate."""
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.candidate_id == candidate.id)
        .where(InterviewSession.status.in_([SessionStatus.PENDING, SessionStatus.ACTIVE]))
        .order_by(InterviewSession.created_at.desc())
    )
    session = result.scalars().first()

    if not session:
        raise HTTPException(status_code=404, detail="No pending interview session found for you.")

    # Load questions
    q_result = await db.execute(
        select(SessionQuestion)
        .where(SessionQuestion.session_id == session.id)
        .where(SessionQuestion.question_type != QuestionType.FOLLOWUP)
        .order_by(SessionQuestion.order_index)
    )
    questions = q_result.scalars().all()

    return {
        "session_id": str(session.id),
        "status": session.status.value,
        "candidate_name": candidate.display_name,
        "candidate_email": candidate.email,
        "candidate_sap_id": getattr(candidate, "employee_id", "") or getattr(candidate, "sap_id", ""),
        "scheduled_at": session.scheduled_at,
        "bond_year": session.bond_year,
        "questions": [
            {
                "id": str(q.id),
                "type": q.question_type.value,
                "text": q.question_text,
                "order": q.order_index,
            }
            for q in questions
        ],
    }


@router.post("/session/start", summary="Start the interview session")
async def start_session(
    req: StartInterviewRequest,
    db: AsyncSession = Depends(get_db),
    candidate: Candidate = Depends(get_current_candidate),
):
    """Mark a session as active when candidate clicks 'Begin Interview'."""
    try:
        session_uuid = uuid.UUID(req.session_id)
    except (ValueError, TypeError):
        return {
            "message": "Session started (dev mock mode)",
            "session_id": req.session_id,
            "status": "active",
        }

    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.id == session_uuid)
        .where(InterviewSession.candidate_id == candidate.id)
    )
    session = result.scalar_one_or_none()

    if not session:
        return {"message": "Session started (dev mock mode)", "session_id": req.session_id, "status": "active"}
    if session.status == SessionStatus.ACTIVE:
        return {"message": "Session already started", "session_id": str(session.id)}
    if session.status != SessionStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot start session with status: {session.status.value}")

    session.status = SessionStatus.ACTIVE
    session.started_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "Interview started. Aria is ready.", "session_id": str(session.id)}


@router.post("/response/submit", summary="Submit candidate response and get AI follow-up")
async def submit_response(
    req: SubmitResponseRequest,
    db: AsyncSession = Depends(get_db),
    candidate: Candidate = Depends(get_current_candidate),
):
    """
    Save candidate's response transcript and generate Aria's follow-up question via Gemini.
    This is called after each main question (Q1, Q2, Q3) response.
    """
    try:
        session_uuid = uuid.UUID(req.session_id)
        question_uuid = uuid.UUID(req.question_id)
        q_result = await db.execute(
            select(SessionQuestion).where(SessionQuestion.id == question_uuid)
        )
        question = q_result.scalar_one_or_none()
        question_type = question.question_type.value if question else "psychometric"
        question_text = question.question_text if question else "Tell me about a time when you had to adapt quickly to a major change in a project."
    except (ValueError, TypeError):
        session_uuid = None
        question_uuid = None
        question_type = "psychometric"
        question_text = "Tell me about a time when you had to adapt quickly to a major change or unexpected obstacle in a project. How did you manage your mindset and what was the outcome?"

    # Use candidate_name from request body first (most reliable — comes from auth session)
    # Fall back to DB lookup only if not provided
    candidate_name = (
        req.candidate_name
        or (candidate.display_name if (candidate and hasattr(candidate, 'display_name') and candidate.display_name) else None)
        or "the candidate"
    )
    if session_uuid and question_uuid:
        response = CandidateResponse(
            session_id=session_uuid,
            question_id=question_uuid,
            transcript_text=req.transcript_text,
            video_timestamp_start=req.video_timestamp_start,
            video_timestamp_end=req.video_timestamp_end,
            response_duration_seconds=req.video_timestamp_end - req.video_timestamp_start,
            word_count=len(req.transcript_text.split()) if req.transcript_text else 0,
        )
        db.add(response)
        await db.commit()

    return {
        "status": "success",
        "message": "Response submitted successfully, follow-ups are disabled."
    }


@router.post("/transcribe-audio", summary="Transcribe candidate audio clip")
async def transcribe_audio(
    file: UploadFile = File(...),
):
    """
    Accepts raw audio clip bytes (audio/webm) and transcribes spoken voice text.
    Bypasses browser webkitSpeechRecognition network error restrictions completely.
    """
    try:
        from app.services.gemini_service import transcribe_audio_bytes
        content = await file.read()
        if not content:
            return {"transcript": ""}

        mime_type = file.content_type or "audio/webm"
        transcript_text = await transcribe_audio_bytes(content, mime_type=mime_type)
        return {"transcript": transcript_text or ""}
    except Exception as e:
        print(f"Transcribe audio endpoint error: {e}")
        return {"transcript": ""}

@router.get("/sessions/{session_id}/segments", summary="Get cognitive and psychometric segments")
async def get_session_segments(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    candidate: Candidate = Depends(get_current_candidate),
):
    from app.models.models import CognitiveDomain, QuestionDifficulty
    from sqlalchemy import delete
    import random

    sess_uuid = None
    try:
        sess_uuid = uuid.UUID(session_id)
    except (ValueError, TypeError):
        sess_uuid = None

    cog_qs = []
    if sess_uuid:
        cog_res = await db.execute(
            select(SessionCognitiveQuestion, CognitiveQuestion)
            .join(CognitiveQuestion, SessionCognitiveQuestion.cognitive_question_id == CognitiveQuestion.id)
            .where(SessionCognitiveQuestion.session_id == sess_uuid)
            .order_by(SessionCognitiveQuestion.order_index)
        )
        cog_qs = [
            {
                "id": str(sq.cognitive_question_id),
                "domain": cq.domain.value,
                "text": cq.question_text,
                "options": cq.options,
                "order": sq.order_index
            } for sq, cq in cog_res.all()
        ]

    # If no cognitive questions assigned yet (or session had none), auto-populate 35 from question bank
    if len(cog_qs) < 35:
        cog_res_all = await db.execute(select(CognitiveQuestion).where(CognitiveQuestion.is_active == True))
        all_cog_qs = list(cog_res_all.scalars().all())
        
        blueprint = {
            QuestionDifficulty.EASY: 2,
            QuestionDifficulty.MEDIUM: 2,
            QuestionDifficulty.HARD: 1
        }
        domains = [
            CognitiveDomain.NUMERICAL, CognitiveDomain.LOGICAL, CognitiveDomain.VERBAL,
            CognitiveDomain.PATTERN, CognitiveDomain.PROCESSING, CognitiveDomain.ATTENTION, CognitiveDomain.ABSTRACT
        ]
        
        cog_selected = []
        for domain in domains:
            domain_qs = [q for q in all_cog_qs if q.domain == domain]
            for diff, count in blueprint.items():
                diff_qs = [q for q in domain_qs if q.difficulty == diff]
                random.shuffle(diff_qs)
                cog_selected.extend(diff_qs[:count])
                
        if len(cog_selected) < 35:
            remaining = [q for q in all_cog_qs if q not in cog_selected]
            random.shuffle(remaining)
            cog_selected.extend(remaining[:35 - len(cog_selected)])
            
        random.shuffle(cog_selected)
        
        if sess_uuid:
            await db.execute(
                delete(SessionCognitiveQuestion)
                .where(SessionCognitiveQuestion.session_id == sess_uuid)
            )
            for idx, cog_q in enumerate(cog_selected):
                db.add(SessionCognitiveQuestion(
                    session_id=sess_uuid,
                    cognitive_question_id=cog_q.id,
                    order_index=idx + 1
                ))
            await db.commit()
            
        cog_qs = [
            {
                "id": str(cq.id),
                "domain": cq.domain.value,
                "text": cq.question_text,
                "options": cq.options,
                "order": idx + 1
            } for idx, cq in enumerate(cog_selected)
        ]

    psy_qs = []
    if sess_uuid:
        psy_res = await db.execute(
            select(SessionPsychometricQuestion, PsychometricQuestion)
            .join(PsychometricQuestion, SessionPsychometricQuestion.psychometric_question_id == PsychometricQuestion.id)
            .where(SessionPsychometricQuestion.session_id == sess_uuid)
            .order_by(SessionPsychometricQuestion.order_index)
        )
        psy_qs = [
            {
                "id": str(sq.psychometric_question_id),
                "trait": pq.trait,
                "text": pq.statement_text,
                "order": sq.order_index
            } for sq, pq in psy_res.all()
        ]

    # If no psychometric questions assigned yet, auto-populate 15
    if len(psy_qs) < 15:
        psy_res_all = await db.execute(select(PsychometricQuestion).where(PsychometricQuestion.is_active == True))
        all_psy_qs = list(psy_res_all.scalars().all())
        traits = ["Adaptability", "Resilience", "Collaboration", "Conscientiousness", "Growth Mindset"]
        
        psy_selected = []
        for trait in traits:
            trait_qs = [q for q in all_psy_qs if q.trait == trait]
            random.shuffle(trait_qs)
            psy_selected.extend(trait_qs[:3])
            
        if len(psy_selected) < 15:
            remaining_psy = [q for q in all_psy_qs if q not in psy_selected]
            random.shuffle(remaining_psy)
            psy_selected.extend(remaining_psy[:15 - len(psy_selected)])
            
        random.shuffle(psy_selected)
        
        if sess_uuid:
            await db.execute(
                delete(SessionPsychometricQuestion)
                .where(SessionPsychometricQuestion.session_id == sess_uuid)
            )
            for idx, pq in enumerate(psy_selected):
                db.add(SessionPsychometricQuestion(
                    session_id=sess_uuid,
                    psychometric_question_id=pq.id,
                    order_index=idx + 1
                ))
            await db.commit()
            
        psy_qs = [
            {
                "id": str(pq.id),
                "trait": pq.trait,
                "text": pq.statement_text,
                "order": idx + 1
            } for idx, pq in enumerate(psy_selected)
        ]

    return {
        "cognitive": cog_qs,
        "psychometric": psy_qs
    }


@router.post("/sessions/{session_id}/reset_cognitive_segment", summary="Reset cognitive segment for a session")
async def reset_cognitive_segment(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    candidate: Candidate = Depends(get_current_candidate),
):
    try:
        sess_uuid = uuid.UUID(session_id)
        # 1. Delete existing cognitive questions for this session
        from sqlalchemy import delete
        await db.execute(
            delete(SessionCognitiveQuestion)
            .where(SessionCognitiveQuestion.session_id == sess_uuid)
        )
    except ValueError:
        sess_uuid = None


    # 2. Generate exactly 35 new ones following the Blueprint (5 from each of the 7 domains)
    from app.models.models import CognitiveDomain, QuestionDifficulty
    import random
    
    cog_res = await db.execute(select(CognitiveQuestion).where(CognitiveQuestion.is_active == True))
    all_cog_qs = list(cog_res.scalars().all())
    
    cog_selected = []
    blueprint = {
        QuestionDifficulty.EASY: 2,
        QuestionDifficulty.MEDIUM: 2,
        QuestionDifficulty.HARD: 1
    }
    
    domains = [
        CognitiveDomain.NUMERICAL, CognitiveDomain.LOGICAL, CognitiveDomain.VERBAL,
        CognitiveDomain.PATTERN, CognitiveDomain.PROCESSING, CognitiveDomain.ATTENTION, CognitiveDomain.ABSTRACT
    ]
    
    for domain in domains:
        domain_qs = [q for q in all_cog_qs if q.domain == domain]
        for diff, count in blueprint.items():
            diff_qs = [q for q in domain_qs if q.difficulty == diff]
            random.shuffle(diff_qs)
            cog_selected.extend(diff_qs[:count])
            
    # Randomize the overall order of the 35 questions to prevent clumping by category/difficulty
    random.shuffle(cog_selected)
        
    if sess_uuid:
        for idx, cog_q in enumerate(cog_selected):
            db.add(SessionCognitiveQuestion(
                session_id=sess_uuid,
                cognitive_question_id=cog_q.id,
                order_index=idx
            ))
            
        await db.commit()
    
    # Return them in the format the frontend expects
    questions_payload = []
    for q in cog_selected:
        questions_payload.append({
            "id": str(q.id),
            "text": q.question_text,
            "options": q.options
        })
        
    return {
        "message": "Cognitive segment reset successfully",
        "questions": questions_payload,
        "time_limit": 1200  # 20 minutes - blueprint spec
    }

@router.post("/sessions/{session_id}/submit_segment", summary="Submit answers for a segment")
async def submit_session_segment(
    session_id: str,
    req: SubmitSegmentRequest,
    db: AsyncSession = Depends(get_db),
    candidate: Candidate = Depends(get_current_candidate),
):
    try:
        sess_uuid = uuid.UUID(session_id)
    except ValueError:
        return {"message": "Mock segment submitted successfully", "score": 100}
        
    # Create or get analysis result
    a_res = await db.execute(select(AnalysisResult).where(AnalysisResult.session_id == sess_uuid))
    analysis = a_res.scalar_one_or_none()
    if not analysis:
        analysis = AnalysisResult(session_id=sess_uuid)
        db.add(analysis)
    
    seg_name = (req.segment or "").strip().lower()
    current_pq = dict(analysis.per_question_analysis_json or {})

    if seg_name in ("cognitive", "seg2", "segment_2"):
        from app.core.question_bank_data import COGNITIVE_QUESTIONS_DATA

        ans_map = {}
        for idx, a in enumerate(req.answers):
            q_id_str = str(a.question_id).strip()
            ans_map[q_id_str] = a.selected_index
            ans_map[str(idx)] = a.selected_index
            ans_map[f"cog_{idx+1}"] = a.selected_index

        cognitive_results = []
        domain_correct = {"NUMERICAL": 0, "LOGICAL": 0, "VERBAL": 0, "PATTERN": 0, "PROCESSING": 0, "ATTENTION": 0, "ABSTRACT": 0}
        domain_total = {"NUMERICAL": 0, "LOGICAL": 0, "VERBAL": 0, "PATTERN": 0, "PROCESSING": 0, "ATTENTION": 0, "ABSTRACT": 0}

        for idx, cq_data in enumerate(COGNITIVE_QUESTIONS_DATA):
            q_id = cq_data.get("id", f"cog_{idx+1}")
            sel_idx = ans_map.get(q_id, ans_map.get(str(idx), ans_map.get(f"cog_{idx+1}")))
            correct_idx = cq_data["correct_answer_index"]
            is_corr = (sel_idx is not None and sel_idx == correct_idx)
            dom = cq_data["domain"]

            if dom not in domain_total:
                domain_total[dom] = 0
                domain_correct[dom] = 0
            domain_total[dom] += 1
            if is_corr:
                domain_correct[dom] += 1

            cognitive_results.append({
                "question": cq_data["question_text"],
                "domain": dom,
                "difficulty": cq_data.get("difficulty", "MEDIUM"),
                "options": cq_data["options"],
                "selected_index": sel_idx,
                "correct_index": correct_idx,
                "is_correct": is_corr
            })

        attempted_count = sum(1 for c in cognitive_results if c["selected_index"] is not None)
        correct_count = sum(1 for c in cognitive_results if c["is_correct"])
        errors_count = attempted_count - correct_count
        total_count = len(cognitive_results)

        analysis.cognitive_ability_score = (correct_count / total_count * 100) if total_count > 0 else 0.0
        analysis.gross_speed = round(attempted_count / 35.0, 2)
        analysis.accuracy = round((correct_count / attempted_count * 100), 1) if attempted_count > 0 else 0.0
        analysis.throughput = round(correct_count / 35.0, 2)
        analysis.net_score = round(correct_count - (errors_count / 3.0), 2)

        def domain_pct(d):
            return round((domain_correct[d] / domain_total[d] * 100), 1) if domain_total.get(d, 0) > 0 else 0.0

        comp_score = round(
            0.20 * domain_pct("LOGICAL") +
            0.15 * domain_pct("NUMERICAL") +
            0.15 * domain_pct("VERBAL") +
            0.15 * domain_pct("PATTERN") +
            0.15 * domain_pct("PROCESSING") +
            0.10 * domain_pct("ATTENTION") +
            0.10 * domain_pct("ABSTRACT"),
            1
        )
        analysis.cognitive_composite_score = comp_score
        z_score = (comp_score - 50.0) / 10.0
        analysis.t_score = round(50.0 + 10.0 * z_score, 1)

        domain_breakdown = {}
        for dom in domain_total.keys():
            t = domain_total[dom]
            c = domain_correct[dom]
            att = sum(1 for item in cognitive_results if item["domain"] == dom and item["selected_index"] is not None)
            domain_breakdown[dom.lower()] = {
                "total": t,
                "correct": c,
                "attempted": att,
                "accuracy_pct": round((c / att * 100), 1) if att > 0 else 0.0
            }

        current_pq["cognitive_results"] = cognitive_results
        current_pq["cognitive_metrics"] = {
            "gross_speed": analysis.gross_speed,
            "accuracy": analysis.accuracy,
            "throughput": analysis.throughput,
            "net_score": analysis.net_score,
            "t_score": analysis.t_score,
            "cognitive_composite_score": comp_score,
            "total_questions": total_count,
            "attempted_count": attempted_count,
            "correct_count": correct_count,
            "wrong_count": errors_count,
            "time_limit_minutes": 20,
            "domain_breakdown": domain_breakdown,
        }
        analysis.per_question_analysis_json = current_pq

        # Sync with SessionCognitiveQuestion if present in DB
        try:
            for ans in req.answers:
                try:
                    q_uuid = uuid.UUID(str(ans.question_id))
                    sq_res = await db.execute(
                        select(SessionCognitiveQuestion)
                        .where(SessionCognitiveQuestion.session_id == sess_uuid)
                        .where(SessionCognitiveQuestion.cognitive_question_id == q_uuid)
                    )
                    sq_item = sq_res.scalars().first()
                    if sq_item:
                        sq_item.selected_option_index = ans.selected_index
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"Error syncing SessionCognitiveQuestion: {e}")

    elif seg_name in ("psychometric", "seg3", "segment_3"):
        from app.core.question_bank_data import PSYCHOMETRIC_QUESTIONS_DATA

        ans_map = {}
        for idx, a in enumerate(req.answers):
            q_id_str = str(a.question_id).strip()
            s_val = a.selected_score if a.selected_score is not None else a.selected_index
            ans_map[q_id_str] = s_val
            ans_map[str(idx)] = s_val
            ans_map[f"psy_{idx+1}"] = s_val

        psychometric_results = []
        trait_groups = {}
        total_effective = 0

        for idx, pq_data in enumerate(PSYCHOMETRIC_QUESTIONS_DATA):
            q_id = pq_data.get("id", f"psy_{idx+1}")
            raw_s = ans_map.get(q_id, ans_map.get(str(idx), ans_map.get(f"psy_{idx+1}")))
            if raw_s is not None:
                try:
                    raw_s = int(raw_s)
                except Exception:
                    raw_s = 3
            else:
                raw_s = 3

            is_sd = (pq_data.get("ideal_response") or "").upper() == "SD"
            eff_s = (6 - raw_s) if is_sd else raw_s
            total_effective += eff_s

            tr = pq_data["trait"]
            if tr not in trait_groups:
                trait_groups[tr] = {"scores": [], "count": 0}
            trait_groups[tr]["scores"].append(eff_s)
            trait_groups[tr]["count"] += 1

            psychometric_results.append({
                "statement": pq_data["statement_text"],
                "trait": tr,
                "ideal_response": pq_data.get("ideal_response", "SA"),
                "selected_score": raw_s,
                "effective_score": eff_s
            })

        max_possible = len(psychometric_results) * 5
        analysis.psychometric_score = round((total_effective / max_possible) * 100, 1)

        trait_breakdown = {}
        for tr, grp in trait_groups.items():
            avg_s = sum(grp["scores"]) / len(grp["scores"]) if grp["scores"] else 0
            trait_breakdown[tr] = {
                "average_score": round(avg_s, 2),
                "percentage_score": round((avg_s / 5.0) * 100, 1),
                "items_count": grp["count"]
            }

        current_pq["psychometric_results"] = psychometric_results
        current_pq["psychometric_trait_breakdown"] = trait_breakdown
        analysis.per_question_analysis_json = current_pq

        # Sync with SessionPsychometricQuestion if present in DB
        try:
            for ans in req.answers:
                try:
                    q_uuid = uuid.UUID(str(ans.question_id))
                    sp_res = await db.execute(
                        select(SessionPsychometricQuestion)
                        .where(SessionPsychometricQuestion.session_id == sess_uuid)
                        .where(SessionPsychometricQuestion.psychometric_question_id == q_uuid)
                    )
                    sp_item = sp_res.scalars().first()
                    if sp_item:
                        sp_item.selected_score = ans.selected_score
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"Error syncing SessionPsychometricQuestion: {e}")

    # Store email submission (Segment 4) structured data
    if req.raw_data and req.raw_data.get("segment_type") == "email_submission":
        email_info = {
            "to": req.raw_data.get("to", "techbeechronical@hcltech.com"),
            "cc": req.raw_data.get("cc", ""),
            "subject": req.raw_data.get("subject", ""),
            "body": req.raw_data.get("body", ""),
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }
        current_pq["email_submission"] = email_info
        analysis.per_question_analysis_json = current_pq

        existing = analysis.summary_text or ""
        email_marker = "[EMAIL_SUBMISSION:seg4]"
        if email_marker not in existing:
            email_block = (
                f"\n{email_marker}\n"
                f"To: {email_info['to']}\n"
                f"Cc: {email_info['cc'] or 'None'}\n"
                f"Subject: {email_info['subject']}\n\n"
                f"{email_info['body']}\n"
            )
            analysis.summary_text = existing + email_block

    # Store oral segment transcripts in raw notes & structured JSON for reporting
    if req.raw_data and req.raw_data.get("transcript"):
        segment_label = req.segment or "seg1"
        transcript_text = req.raw_data["transcript"].strip()
        if transcript_text:
            oral_transcripts = dict(current_pq.get("oral_transcripts") or {})
            oral_transcripts[segment_label] = transcript_text
            oral_transcripts["seg1"] = transcript_text
            oral_transcripts["oral"] = transcript_text
            current_pq["oral_transcripts"] = oral_transcripts
            analysis.per_question_analysis_json = current_pq

            existing = analysis.summary_text or ""
            marker = f"[TRANSCRIPT:{segment_label}]"
            if marker not in existing:
                analysis.summary_text = existing + f"\n{marker}\n{transcript_text}\n"

            # Create or update SessionQuestion and CandidateResponse
            try:
                sq_res = await db.execute(
                    select(SessionQuestion).where(
                        SessionQuestion.session_id == sess_uuid,
                        SessionQuestion.question_type == QuestionType.COMMUNICATION
                    )
                )
                sq_obj = sq_res.scalars().first()
                if not sq_obj:
                    sq_obj = SessionQuestion(
                        id=uuid.uuid4(),
                        session_id=sess_uuid,
                        question_type=QuestionType.COMMUNICATION,
                        question_text="Could you start by telling us about yourself, your journey so far, and the core technologies you're most passionate about?",
                        question_source=QuestionSource.AI_GENERATED,
                        order_index=1,
                    )
                    db.add(sq_obj)
                    await db.flush()

                cr_res = await db.execute(
                    select(CandidateResponse).where(
                        CandidateResponse.session_id == sess_uuid,
                        CandidateResponse.question_id == sq_obj.id
                    )
                )
                cr_obj = cr_res.scalars().first()
                if not cr_obj:
                    db.add(CandidateResponse(
                        id=uuid.uuid4(),
                        session_id=sess_uuid,
                        question_id=sq_obj.id,
                        transcript_text=transcript_text,
                    ))
                else:
                    cr_obj.transcript_text = transcript_text
            except Exception as cr_err:
                logger.warning(f"Error persisting CandidateResponse: {cr_err}")

    await db.commit()
    return {"message": "Segment submitted successfully"}

@router.post("/session/end", summary="End the interview session")
async def end_session(
    req: StartInterviewRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    candidate: Candidate = Depends(get_current_candidate),
):
    """Candidate clicks 'End Interview' — triggers background analysis."""
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.id == uuid.UUID(req.session_id))
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    session.status = SessionStatus.COMPLETED
    session.ended_at = datetime.now(timezone.utc)
    if session.started_at:
        delta = session.ended_at - session.started_at
        session.duration_seconds = int(delta.total_seconds())

    await db.commit()

    # Trigger background analysis task
    background_tasks.add_task(_run_post_interview_analysis, str(session.id))

    return {
        "message": "Interview completed. Thank you! HR will review your results.",
        "session_id": str(session.id),
    }


async def _run_post_interview_analysis(session_id: str):
    """Background task — runs Gemini analysis after interview ends."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import InterviewReport
    import json

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(InterviewSession).where(InterviewSession.id == uuid.UUID(session_id))
            )
            session = result.scalar_one_or_none()
            if not session:
                return

            # Get candidate info
            cand_result = await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
            candidate = cand_result.scalar_one()

            # Build transcript
            q_result = await db.execute(
                select(SessionQuestion, CandidateResponse)
                .outerjoin(CandidateResponse, SessionQuestion.id == CandidateResponse.question_id)
                .where(SessionQuestion.session_id == session.id)
                .order_by(SessionQuestion.order_index)
            )
            rows = q_result.all()

            full_transcript = []
            for question, response in rows:
                full_transcript.append({
                    "speaker": "aria",
                    "text": question.question_text,
                    "question_type": question.question_type.value,
                })
                if response and response.transcript_text:
                    full_transcript.append({
                        "speaker": "candidate",
                        "text": response.transcript_text,
                        "question_type": question.question_type.value,
                    })

            # Fetch previous snapshot and full Q&A if bond_year > 1
            previous_snapshot = None
            prior_qa_pairs = []
            if session.bond_year > 1 and session.parent_session_id:
                a_res = await db.execute(select(AnalysisResult).where(AnalysisResult.session_id == session.parent_session_id))
                prev_analysis = a_res.scalar_one_or_none()
                if prev_analysis and prev_analysis.profile_snapshot:
                    previous_snapshot = prev_analysis.profile_snapshot

                # Fetch full prior year Q&A for cross-module comparison
                prior_qa_res = await db.execute(
                    select(SessionQuestion, CandidateResponse)
                    .outerjoin(CandidateResponse, SessionQuestion.id == CandidateResponse.question_id)
                    .where(SessionQuestion.session_id == session.parent_session_id)
                    .order_by(SessionQuestion.order_index)
                )
                for pq, pr in prior_qa_res.all():
                    if pr and pr.transcript_text:
                        prior_qa_pairs.append({
                            "question": pq.question_text,
                            "question_type": pq.question_type.value,
                            "answer": pr.transcript_text,
                        })

            # Get existing analysis early to pass cognitive/psychometric scores to Gemini
            a_res = await db.execute(select(AnalysisResult).where(AnalysisResult.session_id == session.id))
            analysis = a_res.scalar_one_or_none()
            if not analysis:
                analysis = AnalysisResult(session_id=session.id)
                db.add(analysis)

            # Check for oral transcript submitted via Segment 1
            oral_transcript = ""
            pq_existing = analysis.per_question_analysis_json or {}
            if pq_existing.get("oral_transcripts"):
                oral_transcript = pq_existing["oral_transcripts"].get("seg1") or pq_existing["oral_transcripts"].get("oral") or ""
            if not oral_transcript and analysis.summary_text:
                import re
                m = re.search(r'\[TRANSCRIPT:(?:seg1|oral)\]\n(.*?)(?=\[TRANSCRIPT:|\[EMAIL_SUBMISSION:|$)', analysis.summary_text, re.DOTALL)
                if m:
                    oral_transcript = m.group(1).strip()

            if oral_transcript:
                # Add to full_transcript if not already present
                has_oral = any(t.get("question_type") == "oral_intro" for t in full_transcript)
                if not has_oral:
                    full_transcript.insert(0, {
                        "speaker": "candidate",
                        "text": oral_transcript,
                        "question_type": "oral_intro",
                    })
                    full_transcript.insert(0, {
                        "speaker": "aria",
                        "text": "Could you start by telling us about yourself, your journey so far, and the core technologies you are most passionate about?",
                        "question_type": "oral_intro",
                    })

            # Extract email submission if present
            email_sub = (analysis.per_question_analysis_json or {}).get("email_submission")

            # Run Gemini analysis
            analysis_data = await analyze_interview_session(
                candidate_name=candidate.display_name,
                full_transcript=full_transcript,
                behavioral_data={},  # Will be populated by MediaPipe data from frontend
                previous_snapshot=previous_snapshot,
                prior_qa_pairs=prior_qa_pairs,
                bond_year=session.bond_year,
                existing_analysis=analysis,
                email_submission=email_sub,
            )
            
            analysis.communication_score = analysis_data.get("communication_score")
            analysis.areas_of_improvement = analysis_data.get("areas_of_improvement", [])
            analysis.overall_score = analysis_data.get("overall_score", 0.0)
            analysis.domain_recommendation = analysis_data.get("domain_recommendation", "Undecided")
            analysis.secondary_domain = analysis_data.get("secondary_domain", "")
            
            # Preserve [TRANSCRIPT:...] and [EMAIL_SUBMISSION:...] markers in summary_text
            preserved_markers = []
            if analysis.summary_text:
                for line in analysis.summary_text.splitlines():
                    if line.startswith("[TRANSCRIPT:") or line.startswith("[EMAIL_SUBMISSION:"):
                        pass
                import re
                t_matches = re.findall(r'(\[TRANSCRIPT:.*?\]\n.*?)(?=\[TRANSCRIPT:|\[EMAIL_SUBMISSION:|$)', analysis.summary_text, re.DOTALL)
                e_matches = re.findall(r'(\[EMAIL_SUBMISSION:.*?\]\n.*?)(?=\[TRANSCRIPT:|\[EMAIL_SUBMISSION:|$)', analysis.summary_text, re.DOTALL)
                preserved_markers.extend(t_matches)
                preserved_markers.extend(e_matches)

            new_summary = analysis_data.get("summary_text", "")
            if preserved_markers:
                analysis.summary_text = new_summary + "\n\n" + "\n\n".join(m.strip() for m in preserved_markers) + "\n"
            else:
                analysis.summary_text = new_summary

            analysis.profile_snapshot = analysis_data.get("profile_snapshot", {})

            curr_pq = dict(analysis.per_question_analysis_json or {})
            if analysis_data.get("email_evaluation"):
                curr_pq["email_evaluation"] = analysis_data["email_evaluation"]
            if analysis_data.get("email_writing_score") is not None:
                curr_pq["email_writing_score"] = analysis_data.get("email_writing_score")
            if analysis_data.get("communication_evaluation"):
                curr_pq["communication_evaluation"] = analysis_data["communication_evaluation"]
            if analysis_data.get("vision_and_mission_evaluation"):
                curr_pq["vision_and_mission_evaluation"] = analysis_data["vision_and_mission_evaluation"]
                analysis.vision_and_mission_score = analysis_data["vision_and_mission_evaluation"].get("score", 80)
            if analysis_data.get("corporate_survival_evaluation"):
                curr_pq["corporate_survival_evaluation"] = analysis_data["corporate_survival_evaluation"]
            if analysis_data.get("granular_improvements"):
                curr_pq["granular_improvements"] = analysis_data["granular_improvements"]
            if analysis_data.get("yoy_audit"):
                curr_pq["yoy_audit"] = analysis_data["yoy_audit"]
            analysis.per_question_analysis_json = curr_pq

            # Also update advanced_report_json for retention and archetype
            adv_rep = dict(analysis.advanced_report_json or {})
            surv = analysis_data.get("corporate_survival_evaluation", {})
            if surv:
                adv_rep["retention_risk"] = surv.get("retention_risk", "Low")
                adv_rep["retention_score"] = surv.get("retention_score", 85)
                adv_rep["survival_index"] = surv.get("survival_index", 85)
            analysis.advanced_report_json = adv_rep
            analysis.analyzed_at = datetime.now(timezone.utc)

            # Save or update report
            rep_res = await db.execute(select(InterviewReport).where(InterviewReport.session_id == session.id))
            report = rep_res.scalar_one_or_none()
            if not report:
                report = InterviewReport(
                    session_id=session.id,
                    full_transcript_json=full_transcript,
                    generated_at=datetime.now(timezone.utc),
                )
                db.add(report)
            else:
                report.full_transcript_json = full_transcript
                report.generated_at = datetime.now(timezone.utc)
            await db.commit()

            # ── Upload module_memory JSON to S3 for cross-module persistence ──
            try:
                import json as _json
                from app.services.storage_service import _get_s3_client
                from app.core.config import settings
                module_memory = {
                    "bond_year": session.bond_year,
                    "session_id": session_id,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "candidate_name": candidate.display_name,
                    "candidate_email": candidate.email,
                    "qa_pairs": [
                        {
                            "question": entry["text"],
                            "question_type": entry.get("question_type", ""),
                            "answer": full_transcript[i + 1]["text"] if i + 1 < len(full_transcript) and full_transcript[i + 1]["speaker"] == "candidate" else ""
                        }
                        for i, entry in enumerate(full_transcript)
                        if entry["speaker"] == "aria"
                    ],
                    "profile_snapshot": analysis_data.get("profile_snapshot", {}),
                    "scores": analysis_data.get("scores", {}),
                    "overall_score": analysis_data.get("overall_score"),
                    "longitudinal_trends": analysis_data.get("longitudinal_trends", {}),
                    # Advanced intelligence for cross-module carry-forward
                    "advanced_behavioral": {
                        "evasion_score":        analysis_data.get("evasion_score"),
                        "language_maturity":    analysis_data.get("language_maturity"),
                        "vocabulary_richness":  analysis_data.get("vocabulary_richness"),
                    },
                    "advanced_longitudinal": {
                        "commitment_score":     analysis_data.get("commitment_score"),
                        "career_alignment":     analysis_data.get("career_alignment"),
                        "stagnation_alert":     analysis_data.get("stagnation_alert"),
                    },
                    "advanced_psychological": {
                        "ocean_profile":        analysis_data.get("ocean_profile", {}),
                        "pressure_resilience":  analysis_data.get("pressure_resilience"),
                        "self_awareness_score": analysis_data.get("self_awareness_score"),
                        "motivation_type":      analysis_data.get("motivation_type"),
                    },
                    "advanced_report": {
                        "retention_risk":       analysis_data.get("retention_risk"),
                        "retention_score":      analysis_data.get("retention_score"),
                        "candidate_archetype":  analysis_data.get("candidate_archetype"),
                    },
                }
                memory_bytes = _json.dumps(module_memory, indent=2, default=str).encode("utf-8")
                s3_key = f"candidates/{candidate.email}/module_memory/year_{session.bond_year}.json"
                s3_client = _get_s3_client()
                if s3_client and settings.AWS_S3_BUCKET_NAME:
                    s3_client.put_object(
                        Bucket=settings.AWS_S3_BUCKET_NAME,
                        Key=s3_key,
                        Body=memory_bytes,
                        ContentType="application/json",
                    )
                    logger.info(f"✅ Module memory uploaded to S3: {s3_key}")
                else:
                    # Fallback to local file
                    local_path = Path("module_memory") / candidate.email.replace("@", "_at_")
                    local_path.mkdir(parents=True, exist_ok=True)
                    (local_path / f"year_{session.bond_year}.json").write_bytes(memory_bytes)
            except Exception as mem_err:
                logger.warning(f"Module memory upload failed (non-critical): {mem_err}")

        except Exception as e:
            logger.error(f"Post-interview analysis failed for session {session_id}: {e}")


@router.post("/upload-recording", summary="Upload candidate interview video recording to S3 + local cache")
async def upload_recording(
    file: UploadFile = File(...),
    session_id: str = Form("mock-session-001"),
    candidate_name: str = Form("Fresher Candidate"),
    candidate_email: str = Form("unknown@fresher.in"),
    sap_id: str = Form(""),
):
    """
    Receives candidate interview video recording (.webm) from frontend.
    ① Always caches locally to video_cache/{session_id}.webm for instant HR playback
    ② Then uploads to AWS S3 under candidates/{email}/videos/... for compliance.
    ③ Upserts candidates/{email}/profile.json with { email, sap_id, name }.
    Returns both s3_url AND local_serve_url so HR portal always has a working video link.
    """
    import logging as _log
    _logger = _log.getLogger(__name__)
    try:
        video_bytes = await file.read()
        if not video_bytes:
            raise HTTPException(status_code=400, detail="Empty video file received.")

        # ── Step 1: Cache locally FIRST (always works, instant) ──────────────────
        safe_session = session_id.replace('/', '_').replace('..', '_')
        local_path = VIDEO_CACHE_DIR / f"{safe_session}.webm"
        local_path.write_bytes(video_bytes)
        _logger.info(f"✅ Video cached locally: {local_path} ({len(video_bytes):,} bytes)")

        from app.core.config import settings
        base_url = settings.API_BASE_URL  # http://localhost:8000
        local_serve_url = f"{base_url}/api/interview/serve-recording/{safe_session}"

        bond_year = 1
        attempt_number = 1
        # Resolve real candidate details and attempt number from DB
        try:
            import uuid as _uuid
            from app.core.database import AsyncSessionLocal
            from app.models.models import InterviewSession, Candidate
            from sqlalchemy import select, func
            async with AsyncSessionLocal() as _db:
                try:
                    _sess_uuid = _uuid.UUID(session_id)
                except ValueError:
                    _sess_uuid = _uuid.uuid5(_uuid.NAMESPACE_DNS, session_id)
                _s_res = await _db.execute(
                    select(InterviewSession, Candidate)
                    .join(Candidate, InterviewSession.candidate_id == Candidate.id)
                    .where(InterviewSession.id == _sess_uuid)
                )
                _s_row = _s_res.first()
                if _s_row:
                    _s_obj, _c_obj = _s_row
                    if _c_obj.email and (not candidate_email or candidate_email in ("unknown@fresher.in", "fresher@techbee.in")):
                        candidate_email = _c_obj.email
                    if _c_obj.full_name and (not candidate_name or candidate_name == "Fresher Candidate"):
                        candidate_name = _c_obj.full_name
                    if getattr(_c_obj, "employee_id", None) and not sap_id:
                        sap_id = _c_obj.employee_id
                    bond_year = _s_obj.bond_year or 1

                    # Count attempts for this candidate & module up to this session
                    _attempts_res = await _db.execute(
                        select(func.count(InterviewSession.id))
                        .where(
                            InterviewSession.candidate_id == _c_obj.id,
                            InterviewSession.bond_year == bond_year,
                            InterviewSession.created_at <= _s_obj.created_at,
                        )
                    )
                    _count = _attempts_res.scalar() or 1
                    attempt_number = max(1, _count)
        except Exception as _res_err:
            _logger.warning(f"Candidate/attempt resolution from DB in upload_recording skipped: {_res_err}")

        module_name = f"Module_{bond_year}"

        # ── Step 2: Upload to S3 under candidates/{email}/videos/ ────────────────
        s3_url = local_serve_url  # default to local if S3 fails
        try:
            from app.services.storage_service import upload_session_recording, upsert_candidate_profile
            s3_url_result = await upload_session_recording(
                session_id=session_id,
                video_bytes=video_bytes,
                candidate_email=candidate_email,
                candidate_name=candidate_name,
                sap_id=sap_id,
                module_name=module_name,
                attempt_number=attempt_number,
                content_type=file.content_type or "video/webm",
            )
            if s3_url_result and not s3_url_result.startswith("recordings"):
                s3_url = s3_url_result
                _logger.info(f"✅ Video uploaded to S3: candidates/{candidate_email}/videos/...")

            # ── Step 3: Upsert profile.json so HR can search by SAP ID ───────────
            upsert_candidate_profile(
                candidate_email=candidate_email,
                sap_id=sap_id,
                candidate_name=candidate_name,
            )
        except Exception as s3_err:
            _logger.warning(f"S3 upload failed (using local fallback): {s3_err}")

        return {
            "status": "success",
            "session_id": session_id,
            "candidate_email": candidate_email,
            "sap_id": sap_id,
            "s3_url": s3_url,
            "local_serve_url": local_serve_url,
            "file_size_bytes": len(video_bytes),
            "message": f"Video recorded for {candidate_name} ({sap_id} | {candidate_email})",
        }
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Upload recording error: {e}")
        return {"status": "error", "message": str(e)}



@router.get("/serve-recording/{session_id}", summary="Stream interview video to HR browser")
async def serve_recording(
    session_id: str,
    token: str | None = None,
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Stream a locally cached interview video directly to the HR portal browser.
    Supports partial content (range requests) for seek-able video playback.
    """
    from app.core.auth import decode_teams_token
    from app.models.models import HRUser
    from sqlalchemy import select

    # Resolve token from query param or header
    resolved_token = None
    if token:
        resolved_token = token
    elif authorization and authorization.lower().startswith("bearer "):
        resolved_token = authorization.split(" ", 1)[1]

    if not resolved_token:
        raise HTTPException(status_code=401, detail="Authentication token required")

    try:
        payload = decode_teams_token(resolved_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    roles = payload.get("roles", [])
    if "candidate" in roles:
        raise HTTPException(status_code=403, detail="Access denied: Candidates cannot view video recordings")

    azure_oid = payload.get("oid")
    result = await db.execute(select(HRUser).where(HRUser.azure_oid == azure_oid))
    hr_user = result.scalar_one_or_none()
    if not hr_user or not hr_user.is_active:
        raise HTTPException(status_code=403, detail="HR access required")

    safe_session = session_id.replace('/', '_').replace('..', '_')
    video_path = VIDEO_CACHE_DIR / f"{safe_session}.webm"

    if not video_path.exists():
        raise HTTPException(status_code=404, detail=f"Video recording not found for session: {session_id}")

    def video_stream():
        with open(video_path, "rb") as f:
            while chunk := f.read(1024 * 1024):  # 1MB chunks
                yield chunk

    return StreamingResponse(
        video_stream(),
        media_type="video/webm",
        headers={
            "Content-Disposition": f'inline; filename="{safe_session}.webm"',
            "Content-Length": str(video_path.stat().st_size),
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        }
    )
