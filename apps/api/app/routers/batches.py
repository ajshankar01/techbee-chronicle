"""
Batch Interview Scheduling Router — /api/hr/batches
Handles bulk interview scheduling with email + calendar invite generation
"""
import uuid
import hashlib
import secrets
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.models.models import (
    InterviewSession, Candidate, HRUser, QuestionBank,
    SessionQuestion, SessionStatus, QuestionSource, QuestionType,
    CognitiveQuestion, PsychometricQuestion, SessionCognitiveQuestion, SessionPsychometricQuestion,
    CognitiveDomain, QuestionDifficulty
)
from app.services.email_service import send_batch_invitations

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class CandidateInput(BaseModel):
    identifier: str  # SAP ID or email
    module_override: Optional[int] = None

class BatchCreateRequest(BaseModel):
    name: str
    module_level: Optional[int] = None  # None = auto (use each candidate's own bond year)
    scheduled_date: str  # "2026-09-10"
    scheduled_time: str  # "10:00"
    time_window_hours: int = 8  # hours after scheduled_time that the link is valid
    hr_notes: Optional[str] = None
    cognitive_count: Optional[int] = 35
    psychometric_count: Optional[int] = 10

    candidates: List[CandidateInput]  # list of candidates with optional overrides
    # NOTE: Only candidates already registered in the system (with SAP ID + org email)
    # are eligible. Unregistered identifiers will be returned in the 'unresolved' list.

class CandidateCSVEntry(BaseModel):
    name: str
    email: str
    sap_id: Optional[str] = None
    doj: Optional[str] = None  # "YYYY-MM-DD" or "DD-MM-YYYY"

class RegisterAndResolveRequest(BaseModel):
    candidates: List[CandidateCSVEntry]

class BatchResendRequest(BaseModel):
    candidate_ids: Optional[List[str]] = None  # None = resend to all incomplete


# ── Helper: Resolve candidates from SAP ID or email ──────────────────────────

async def resolve_candidates(identifiers: List[str], db: AsyncSession):
    """
    Resolve SAP IDs / org emails to Candidate DB records.
    IMPORTANT: Only candidates who are already registered in the system
    (issued an org email + SAP ID by HR) can be resolved. Unregistered
    identifiers are returned in the 'unresolved' list so HR can action them.
    """
    resolved = []
    unresolved = []

    for ident in identifiers:
        ident = ident.strip()
        if not ident:
            continue

        if "@" in ident:
            # Match by organisation email
            result = await db.execute(
                select(Candidate).where(
                    Candidate.email == ident,
                    Candidate.is_active == True,  # must be active
                )
            )
        else:
            # Match by SAP / employee ID
            result = await db.execute(
                select(Candidate).where(
                    Candidate.employee_id == ident,
                    Candidate.is_active == True,
                )
            )

        candidate = result.scalar_one_or_none()
        if candidate:
            resolved.append(candidate)
        else:
            unresolved.append(ident)

    return resolved, unresolved


# ── Helper: Seeded random question selection ─────────────────────────────────

from typing import Any
def get_seeded_questions(
    all_questions: List[Any],
    candidate_id: str,
    batch_id: str,
    count: int
) -> List[Any]:
    """
    Select `count` random questions using a deterministic seed derived from
    candidate_id + batch_id. Each candidate gets unique questions in unique order.
    Reproducible: same seed always produces same result (useful for reconnects).
    """
    seed_str = f"{candidate_id}_{batch_id}"
    seed_int = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2**31)
    rng = random.Random(seed_int)

    pool = list(all_questions)
    if len(pool) <= count:
        rng.shuffle(pool)
        return pool

    selected = rng.sample(pool, k=count)
    rng.shuffle(selected)
    return selected


# ── POST /api/hr/batches — Create a new batch ─────────────────────────────────

@router.post("/batches")
async def create_batch(
    req: BatchCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a batch of interview sessions.
    - Resolves each candidate (SAP ID or email)
    - Creates an InterviewSession per candidate with a unique access token
    - Queues email invitations with .ics calendar attachments
    """
    batch_id = str(uuid.uuid4())

    # Parse scheduled datetime
    try:
        scheduled_dt = datetime.strptime(
            f"{req.scheduled_date} {req.scheduled_time}", "%Y-%m-%d %H:%M"
        ).replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date/time format. Use YYYY-MM-DD and HH:MM")

    expires_at = scheduled_dt + timedelta(hours=req.time_window_hours)

    # Resolve candidates
    # Extract identifiers for resolution
    identifiers = [c.identifier for c in req.candidates]
    resolved, unresolved = await resolve_candidates(identifiers, db)

    if not resolved:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "No valid candidates found",
                "unresolved": unresolved
            }
        )

    # Fetch from new question pools
    cog_res = await db.execute(select(CognitiveQuestion).where(CognitiveQuestion.is_active == True))
    all_cognitive = list(cog_res.scalars().all())
    psy_res = await db.execute(select(PsychometricQuestion).where(PsychometricQuestion.is_active == True))
    all_psychometric = list(psy_res.scalars().all())

    # Get a dev HR user (or first HR user)
    hr_result = await db.execute(select(HRUser).limit(1))
    hr_user = hr_result.scalar_one_or_none()
    if not hr_user:
        raise HTTPException(status_code=500, detail="No HR user found in database")

    # Blueprint setup for 35 Cognitive Questions (5 per each of the 7 domains: 2 Easy, 2 Medium, 1 Hard)
    blueprint = {
        QuestionDifficulty.EASY: 2,
        QuestionDifficulty.MEDIUM: 2,
        QuestionDifficulty.HARD: 1,
    }
    domains = [
        CognitiveDomain.NUMERICAL, CognitiveDomain.LOGICAL, CognitiveDomain.VERBAL,
        CognitiveDomain.PATTERN, CognitiveDomain.PROCESSING, CognitiveDomain.ATTENTION, CognitiveDomain.ABSTRACT
    ]
    traits = ["Adaptability", "Resilience", "Collaboration", "Conscientiousness", "Growth Mindset"]

    # Create sessions + assign questions per candidate
    sessions_created = []
    for candidate in resolved:
        session_id = uuid.uuid4()
        access_token = secrets.token_urlsafe(32)

        # Find if this candidate had an override in the request
        cand_sap = (candidate.employee_id or '').upper()
        override_req = next((c for c in req.candidates if c.identifier.lower() == candidate.email.lower() or (cand_sap and c.identifier.upper() == cand_sap)), None)
        
        # Module level: use per-candidate bond year if HR chose 'Auto',
        # otherwise use the HR-specified override for all candidates in this batch,
        # unless the individual candidate has a specific override.
        effective_module = candidate.calculated_bond_year
        if override_req and override_req.module_override is not None:
            effective_module = override_req.module_override
        elif req.module_level is not None:
            effective_module = req.module_level

        parent_id = None
        if effective_module > 1:
            parent_res = await db.execute(
                select(InterviewSession)
                .where(InterviewSession.candidate_id == candidate.id)
                .where(InterviewSession.status == SessionStatus.COMPLETED)
                .where(InterviewSession.bond_year == effective_module - 1)
                .order_by(InterviewSession.ended_at.desc())
            )
            parent_s = parent_res.scalars().first()
            if parent_s:
                parent_id = parent_s.id

        session = InterviewSession(
            id=session_id,
            candidate_id=candidate.id,
            created_by_hr_id=hr_user.id,
            status=SessionStatus.PENDING,
            scheduled_at=scheduled_dt,
            bond_year=effective_module,
            parent_session_id=parent_id,
            notes=getattr(req, "hr_notes", "") or "",
        )

        # Store batch metadata in notes field (JSON-encoded)
        import json
        meta = {
            "batch_id": batch_id,
            "batch_name": req.name,
            "access_token": access_token,
            "token_expires_at": expires_at.isoformat(),
            "email_sent_at": None,
            "module_mode": "auto" if req.module_level is None else "override",
            "effective_module": effective_module,
        }
        session.notes = json.dumps(meta)
        db.add(session)
        await db.flush()  # Get session.id

        # Assign seeded randomized questions for Cognitive: exactly 35 (2E/2M/1H per 7 domains)
        cog_seed_str = f"{candidate.id}_{batch_id}_cog"
        cog_seed_int = int(hashlib.md5(cog_seed_str.encode()).hexdigest(), 16) % (2**31)
        cog_rng = random.Random(cog_seed_int)

        chosen_cog = []
        for domain in domains:
            domain_qs = [q for q in all_cognitive if q.domain == domain]
            for diff, count in blueprint.items():
                diff_qs = [q for q in domain_qs if q.difficulty == diff]
                cog_rng.shuffle(diff_qs)
                chosen_cog.extend(diff_qs[:count])

        # If strict blueprint falls short, fill with remaining cognitive questions up to 35
        if len(chosen_cog) < 35:
            remaining = [q for q in all_cognitive if q not in chosen_cog]
            cog_rng.shuffle(remaining)
            chosen_cog.extend(remaining[:35 - len(chosen_cog)])
        
        # Shuffle overall question order so questions aren't grouped by category
        cog_rng.shuffle(chosen_cog)

        for idx, cq in enumerate(chosen_cog):
            sq = SessionCognitiveQuestion(
                session_id=session.id,
                cognitive_question_id=cq.id,
                order_index=idx + 1,
            )
            db.add(sq)

        # Assign seeded randomized questions for Psychometric: 10 questions (2 per trait)
        psy_seed_str = f"{candidate.id}_{batch_id}_psy"
        psy_seed_int = int(hashlib.md5(psy_seed_str.encode()).hexdigest(), 16) % (2**31)
        psy_rng = random.Random(psy_seed_int)

        chosen_psy = []
        for trait in traits:
            trait_qs = [q for q in all_psychometric if q.trait == trait]
            psy_rng.shuffle(trait_qs)
            chosen_psy.extend(trait_qs[:3])

        if len(chosen_psy) < 15:
            remaining_psy = [q for q in all_psychometric if q not in chosen_psy]
            psy_rng.shuffle(remaining_psy)
            chosen_psy.extend(remaining_psy[:15 - len(chosen_psy)])

        psy_rng.shuffle(chosen_psy)

        for idx, pq in enumerate(chosen_psy):
            sq = SessionPsychometricQuestion(
                session_id=session.id,
                psychometric_question_id=pq.id,
                order_index=idx + 1,
            )
            db.add(sq)

        sessions_created.append({
            "session_id": str(session_id),
            "candidate_id": str(candidate.id),
            "candidate_name": candidate.display_name,
            "candidate_email": candidate.email,
            "sap_id": candidate.employee_id,
            "effective_module": effective_module,
            "access_token": access_token,
        })

    await db.commit()

    # Dispatch invitation emails with calendar invites synchronously in worker thread pool
    if sessions_created:
        import anyio
        await anyio.to_thread.run_sync(
            send_batch_invitations,
            sessions_created,
            req.name,
            batch_id,
            scheduled_dt,
            expires_at,
            req.module_level or 1,
        )
        now_iso = datetime.now(timezone.utc).isoformat()
        for session_info in sessions_created:
            sid = session_info["session_id"]
            res = await db.execute(select(InterviewSession).where(InterviewSession.id == uuid.UUID(sid)))
            s_obj = res.scalar_one_or_none()
            if s_obj:
                try:
                    s_meta = json.loads(s_obj.notes or "{}")
                except Exception:
                    s_meta = {}
                s_meta["email_sent_at"] = now_iso
                s_obj.notes = json.dumps(s_meta)
        await db.commit()

    return {
        "batch_id": batch_id,
        "batch_name": req.name,
        "total_scheduled": len(sessions_created),
        "unresolved_count": len(unresolved),
        "unresolved": unresolved,
        "sessions": sessions_created,
        "scheduled_at": scheduled_dt.isoformat(),
        "expires_at": expires_at.isoformat(),
        "status": "created",
    }


# ── GET /api/hr/batches — List all batches ────────────────────────────────────

@router.get("/batches")
async def list_batches(db: AsyncSession = Depends(get_db)):
    """
    List all batches by scanning sessions that have batch_id in their notes.
    Returns aggregated stats per batch.
    """
    import json

    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.notes.like('%"batch_id"%')
        ).order_by(InterviewSession.scheduled_at.desc())
    )
    all_sessions = result.scalars().all()

    # Group by batch_id
    batches: dict = {}
    for s in all_sessions:
        try:
            meta = json.loads(s.notes or "{}")
            bid = meta.get("batch_id")
            if not bid:
                continue
            if bid not in batches:
                batches[bid] = {
                    "batch_id": bid,
                    "batch_name": meta.get("batch_name", "Unnamed Batch"),
                    "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
                    "expires_at": meta.get("token_expires_at"),
                    "total": 0,
                    "pending": 0,
                    "completed": 0,
                    "active": 0,
                    "abandoned": 0,
                }
            b = batches[bid]
            b["total"] += 1
            b[s.status.value if hasattr(s.status, 'value') else str(s.status)] = b.get(
                s.status.value if hasattr(s.status, 'value') else str(s.status), 0
            ) + 1
        except Exception:
            continue

    return {"batches": list(batches.values())}


# ── GET /api/hr/batches/{batch_id} — Batch detail ─────────────────────────────

@router.get("/batches/{batch_id}")
async def get_batch_detail(batch_id: str, db: AsyncSession = Depends(get_db)):
    """Get detailed status of all sessions in a batch."""
    import json

    result = await db.execute(
        select(InterviewSession, Candidate).join(
            Candidate, InterviewSession.candidate_id == Candidate.id
        ).where(
            InterviewSession.notes.like(f'%"batch_id": "{batch_id}"%')
        ).order_by(InterviewSession.created_at)
    )
    rows = result.all()

    if not rows:
        raise HTTPException(status_code=404, detail="Batch not found")

    sessions = []
    batch_meta = {}
    for session, candidate in rows:
        try:
            meta = json.loads(session.notes or "{}")
        except Exception:
            meta = {}

        if not batch_meta:
            batch_meta = {
                "batch_id": batch_id,
                "batch_name": meta.get("batch_name", "Unnamed"),
                "scheduled_at": session.scheduled_at.isoformat() if session.scheduled_at else None,
                "expires_at": meta.get("token_expires_at"),
            }

        sessions.append({
            "session_id": str(session.id),
            "candidate_name": candidate.display_name,
            "candidate_email": candidate.email,
            "sap_id": candidate.employee_id,
            "status": session.status.value if hasattr(session.status, 'value') else str(session.status),
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "email_sent_at": meta.get("email_sent_at"),
            "access_token": meta.get("access_token"),
        })

    return {**batch_meta, "sessions": sessions, "total": len(sessions)}


# ── POST /api/hr/batches/{batch_id}/resend — Resend invitations ────────────────

@router.post("/batches/{batch_id}/resend")
async def resend_batch_invitations(
    batch_id: str,
    req: BatchResendRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Resend email invitations to pending/incomplete candidates in a batch."""
    import json

    result = await db.execute(
        select(InterviewSession, Candidate).join(
            Candidate, InterviewSession.candidate_id == Candidate.id
        ).where(
            and_(
                InterviewSession.notes.like(f'%"batch_id": "{batch_id}"%'),
                InterviewSession.status == SessionStatus.PENDING
            )
        )
    )
    rows = result.all()

    if not rows:
        raise HTTPException(status_code=404, detail="No pending sessions found for this batch")

    sessions_to_resend = []
    scheduled_dt = None
    expires_at = None
    batch_name = "Batch Interview"

    for session, candidate in rows:
        if req.candidate_ids and str(candidate.id) not in req.candidate_ids:
            continue
        try:
            meta = json.loads(session.notes or "{}")
        except Exception:
            meta = {}

        batch_name = meta.get("batch_name", batch_name)
        if session.scheduled_at:
            scheduled_dt = session.scheduled_at
        try:
            expires_at = datetime.fromisoformat(meta.get("token_expires_at", ""))
        except Exception:
            expires_at = (scheduled_dt or datetime.now(timezone.utc)) + timedelta(hours=8)

        sessions_to_resend.append({
            "session_id": str(session.id),
            "candidate_id": str(candidate.id),
            "candidate_name": candidate.display_name,
            "candidate_email": candidate.email,
            "access_token": meta.get("access_token", secrets.token_urlsafe(32)),
        })

    if sessions_to_resend:
        import anyio
        await anyio.to_thread.run_sync(
            send_batch_invitations,
            sessions_to_resend,
            batch_name,
            batch_id,
            scheduled_dt or datetime.now(timezone.utc),
            expires_at or (datetime.now(timezone.utc) + timedelta(hours=8)),
            1,
        )
        # Immediately record email_sent_at timestamp
        now_iso = datetime.now(timezone.utc).isoformat()
        for session, candidate in rows:
            try:
                meta = json.loads(session.notes or "{}")
            except Exception:
                meta = {}
            meta["email_sent_at"] = now_iso
            session.notes = json.dumps(meta)
        await db.commit()

    return {"resent_count": len(sessions_to_resend)}


# ── POST /api/hr/batches/{batch_id}/dispatch — Direct synchronous dispatch ────

@router.post("/batches/{batch_id}/dispatch")
async def dispatch_batch_invitations(
    batch_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Directly and synchronously dispatch emails for a batch.
    Executes in a thread pool and returns the actual delivery results immediately.
    """
    import json
    import anyio

    result = await db.execute(
        select(InterviewSession, Candidate).join(
            Candidate, InterviewSession.candidate_id == Candidate.id
        ).where(
            and_(
                InterviewSession.notes.like(f'%"batch_id": "{batch_id}"%'),
                InterviewSession.status == SessionStatus.PENDING
            )
        )
    )
    rows = result.all()

    if not rows:
        raise HTTPException(status_code=404, detail="No pending sessions found for this batch")

    sessions_to_send = []
    scheduled_dt = None
    expires_at = None
    batch_name = "Batch Interview"

    for session, candidate in rows:
        try:
            meta = json.loads(session.notes or "{}")
        except Exception:
            meta = {}

        batch_name = meta.get("batch_name", batch_name)
        if session.scheduled_at:
            scheduled_dt = session.scheduled_at
        try:
            expires_at = datetime.fromisoformat(meta.get("token_expires_at", ""))
        except Exception:
            expires_at = (scheduled_dt or datetime.now(timezone.utc)) + timedelta(hours=8)

        sessions_to_send.append({
            "session_id": str(session.id),
            "candidate_id": str(candidate.id),
            "candidate_name": candidate.display_name,
            "candidate_email": candidate.email,
            "access_token": meta.get("access_token", secrets.token_urlsafe(32)),
        })

    # Run directly in worker thread pool
    send_res = await anyio.to_thread.run_sync(
        send_batch_invitations,
        sessions_to_send,
        batch_name,
        batch_id,
        scheduled_dt or datetime.now(timezone.utc),
        expires_at or (datetime.now(timezone.utc) + timedelta(hours=8)),
        1,
    )

    # Immediately mark email_sent_at on all sessions in this batch if at least 1 sent
    if isinstance(send_res, dict) and send_res.get("sent", 0) > 0:
        now_iso = datetime.now(timezone.utc).isoformat()
        for session, candidate in rows:
            try:
                meta = json.loads(session.notes or "{}")
            except Exception:
                meta = {}
            meta["email_sent_at"] = now_iso
            session.notes = json.dumps(meta)
        await db.commit()

    return {
        "status": "success",
        "batch_id": batch_id,
        "processed_count": len(sessions_to_send),
        "result": send_res
    }


@router.get("/batches/test-smtp")
async def test_smtp_diagnostic():
    """Diagnostic endpoint to test SMTP directly from the cloud environment."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    results = {}
    for port in [465, 587]:
        try:
            if port == 465:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, 465, timeout=10)
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, port, timeout=10)
                server.ehlo()
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            msg = MIMEMultipart()
            msg["From"] = settings.SMTP_FROM
            msg["To"] = settings.SMTP_USER
            msg["Subject"] = f"Diagnostic Test from Render Port {port}"
            msg.attach(MIMEText(f"SMTP diagnostic test on port {port} succeeded.", "plain"))
            server.sendmail(settings.SMTP_USER, [settings.SMTP_USER], msg.as_string())
            server.quit()
            results[f"port_{port}"] = "SUCCESS"
        except Exception as e:
            results[f"port_{port}"] = f"FAILED: {str(e)}"

    return {
        "smtp_host": settings.SMTP_HOST,
        "smtp_user": settings.SMTP_USER,
        "smtp_enabled": settings.SMTP_ENABLED,
        "results": results
    }


# ── POST /api/hr/batches/register-and-resolve — Auto-register and resolve ──

@router.post("/batches/register-and-resolve")
async def register_and_resolve(
    req: RegisterAndResolveRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Auto-register candidates from CSV data, then resolve them.
    This bypasses Azure AD — candidates are created directly in the DB.
    When Azure AD is connected later, the azure_oid will be linked on first Teams login.
    """
    resolved = []
    already_existed = []
    newly_registered = []
    errors = []

    for entry in req.candidates:
        email = entry.email.strip().lower()
        if not email or '@' not in email:
            errors.append(f"Invalid email: {entry.email}")
            continue

        # Check if already exists
        result = await db.execute(
            select(Candidate).where(Candidate.email == email)
        )
        candidate = result.scalar_one_or_none()

        if candidate:
            # Update fields if provided
            if entry.sap_id and not candidate.employee_id:
                candidate.employee_id = entry.sap_id.strip()
            if entry.name and candidate.display_name == email.split('@')[0].capitalize():
                candidate.display_name = entry.name.strip()
            already_existed.append(email)
        else:
            # Parse join date
            join_date = None
            if entry.doj:
                doj_str = entry.doj.strip()
                for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%m/%d/%Y"]:
                    try:
                        join_date = datetime.strptime(doj_str, fmt).replace(tzinfo=timezone.utc)
                        break
                    except ValueError:
                        continue

            import hashlib as _hashlib
            h = _hashlib.md5(email.encode('utf-8')).hexdigest()
            dummy_oid = f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"

            sap_id = entry.sap_id.strip() if entry.sap_id else f"SAP{random.randint(100000, 999999)}"

            candidate = Candidate(
                azure_oid=dummy_oid,
                display_name=entry.name.strip() or email.split('@')[0].capitalize(),
                email=email,
                employee_id=sap_id,
                is_active=True,
                join_date=join_date or datetime.now(timezone.utc),
                current_bond_year=1,
            )
            db.add(candidate)
            newly_registered.append(email)

        resolved.append(candidate)

    await db.commit()
    # Refresh all candidates to get their IDs
    for c in resolved:
        await db.refresh(c)

    return {
        "resolved": [
            {
                "id": str(c.id),
                "name": c.display_name,
                "email": c.email,
                "sap_id": c.employee_id,
                "is_active": c.is_active,
                "current_module": c.calculated_bond_year,
                "module_label": f"Module {c.calculated_bond_year}",
                "join_date": c.join_date.strftime("%d %b %Y") if c.join_date else None,
            }
            for c in resolved
        ],
        "unresolved": [],
        "errors": errors,
        "resolved_count": len(resolved),
        "newly_registered": len(newly_registered),
        "already_existed": len(already_existed),
        "note": f"{len(newly_registered)} new candidates registered, {len(already_existed)} already existed.",
    }


# ── GET /api/hr/batches/{batch_id}/resolve — Preview candidate resolution ──────

@router.post("/batches/resolve")
async def resolve_candidates_preview(
    identifiers: List[str],
    db: AsyncSession = Depends(get_db)
):
    """
    Preview candidate resolution before creating a batch.
    Returns which identifiers matched registered candidates and which didn't.
    Only active, registered candidates (with SAP ID + org email) are resolved.
    """
    resolved, unresolved = await resolve_candidates(identifiers, db)
    return {
        "resolved": [
            {
                "id": str(c.id),
                "name": c.display_name,
                "email": c.email,
                "sap_id": c.employee_id,
                "is_active": c.is_active,
                "current_module": c.calculated_bond_year,
                "module_label": f"Module {c.calculated_bond_year}",
                "join_date": c.join_date.strftime("%d %b %Y") if c.join_date else None,
            }
            for c in resolved
        ],
        "unresolved": unresolved,
        "resolved_count": len(resolved),
        "unresolved_count": len(unresolved),
        "note": "Only active registered candidates are returned. Unresolved entries are not in the system — register them first via HR > Candidates.",
    }


# ── GET /api/hr/questions/random — Get random questions for fallback interviews ──

@router.get("/questions/random")
async def get_random_questions(
    count: int = 5,
    categories: Optional[str] = None,  # comma-separated
    bond_year: int = 1,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns random questions from the question bank for fallback interviews
    (when no scheduled session exists). Used by the interview frontend.
    """
    type_map = {
        "psychometric": QuestionType.PSYCHOMETRIC,
        "communication": QuestionType.COMMUNICATION,
        "adaptability": QuestionType.ADAPTABILITY,
        "endurance": QuestionType.ENDURANCE,
        "cognitive": QuestionType.COGNITIVE_ABILITY,
        "forensic_analysis": QuestionType.FORENSIC_ANALYSIS,
        "scenario": QuestionType.FORENSIC_ANALYSIS,
        "team_management": QuestionType.TEAM_MANAGEMENT,
        "leadership_quality": QuestionType.LEADERSHIP_QUALITY,
        "vision_and_mission": QuestionType.VISION_AND_MISSION,
    }

    if categories:
        cat_list = [c.strip() for c in categories.split(',')]
        selected_types = [type_map[c] for c in cat_list if c in type_map]
    else:
        selected_types = [QuestionType.PSYCHOMETRIC, QuestionType.ADAPTABILITY, QuestionType.COMMUNICATION]

    if not selected_types:
        selected_types = [QuestionType.PSYCHOMETRIC, QuestionType.ADAPTABILITY]

    q_result = await db.execute(
        select(QuestionBank).where(
            and_(
                QuestionBank.question_type.in_(selected_types),
                QuestionBank.is_active == True
            )
        )
    )
    all_questions = q_result.scalars().all()

    if not all_questions:
        return {"questions": []}

    # Use random selection
    pool = list(all_questions)
    random.shuffle(pool)
    selected = pool[:min(count, len(pool))]

    return {
        "questions": [
            {
                "id": str(q.id),
                "type": q.question_type.value,
                "text": q.question_text,
                "order": idx + 1,
            }
            for idx, q in enumerate(selected)
        ],
        "total_available": len(all_questions),
    }
