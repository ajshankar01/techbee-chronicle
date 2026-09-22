"""
S3 Router — Lists videos and reports from S3 bucket for HR portal.
Email-based folder structure for 1000 fresher candidates.

S3 Key Patterns:
  candidates/{email}/videos/{YYYYMMDD_HHMMSS}_{session_id[:8]}.webm
  candidates/{email}/reports/{YYYYMMDD_HHMMSS}_{session_id[:8]}.pdf
"""
import logging
import re
import datetime
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/s3", tags=["S3 Asset Browser"])

BUCKET_NAME = "ai-interview-ajay-dev"
REGION      = "ap-southeast-2"
PRESIGN_TTL = 3600  # 1 hour


def _s3_client():
    return boto3.client("s3", region_name=REGION)


def _presign(s3, key: str) -> str:
    """Generate a 1-hour presigned GET URL for an S3 object."""
    try:
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": key},
            ExpiresIn=PRESIGN_TTL,
        )
    except Exception:
        return f"https://{BUCKET_NAME}.s3.{REGION}.amazonaws.com/{key}"


def _match_session_ids(s3_id: str, db_id: str) -> bool:
    """
    Check if the client-side session ID matches the database UUID session ID.
    Supports exact match, prefix match, and UUID5 DNS namespace hashing match.
    """
    if not s3_id or not db_id:
        return False
    s3_clean = s3_id.replace("-", "").strip()
    db_clean = db_id.replace("-", "").strip()
    if s3_clean == db_clean or s3_clean.startswith(db_clean) or db_clean.startswith(s3_clean):
        return True
    try:
        import uuid
        u5 = str(uuid.uuid5(uuid.NAMESPACE_DNS, s3_id)).replace("-", "")
        if u5 == db_clean:
            return True
    except Exception:
        pass
    return False


def _parse_video_key(key: str) -> dict | None:
    """
    Parse S3 video key. Supports both:
    1. Standardized: candidates/{email}/videos/{sap_id}_{module}_Attempt{attempt}_{YYYYMMDD_HHMMSS}_{session_id[:8]}.webm
    2. Legacy:       candidates/{email}/videos/{YYYYMMDD_HHMMSS}_{session_id}.webm
    """
    # Try standardized format first
    m = re.match(
        r"candidates/(?P<email>[^/]+)/videos/(?P<sap>[^_]+)_(?P<module>[^_]+)_Attempt(?P<attempt>\d+)_(?P<ts>\d{8}_\d{6})_(?P<session>[^.]+)\.webm$",
        key
    )
    sap_id = ""
    module_name = ""
    attempt_num = 1

    if m:
        sap_id = m.group("sap")
        module_name = m.group("module")
        attempt_num = int(m.group("attempt"))
    else:
        # Fallback to legacy format
        m = re.match(
            r"candidates/(?P<email>[^/]+)/videos/(?P<ts>\d{8}_\d{6})_(?P<session>[^.]+)\.webm$",
            key
        )
        if not m:
            return None

    ts_str = m.group("ts")
    try:
        ts_dt = datetime.datetime.strptime(ts_str, "%Y%m%d_%H%M%S")
        ist_dt = ts_dt + datetime.timedelta(hours=5, minutes=30)
        ts_display = ist_dt.strftime("%d %b %Y, %I:%M %p IST")
    except Exception:
        ts_display = ts_str

    email = m.group("email")
    name_from_email = email.split("@")[0].replace(".", " ").replace("_", " ").title()

    bond_year_val = 1
    if module_name:
        by_match = re.search(r"\d+", module_name)
        if by_match:
            bond_year_val = int(by_match.group(0))

    return {
        "email":            email,
        "candidate_name":   name_from_email,
        "session_id":       m.group("session"),
        "timestamp":        ts_str,
        "timestamp_display": ts_display,
        "s3_key":           key,
        "sap_id":           sap_id if sap_id != "SAPID_UNKNOWN" else "",
        "module":           module_name,
        "attempt_number":   attempt_num,
        "bond_year":        bond_year_val,
    }


def _parse_report_key(key: str) -> dict | None:
    """
    Parse S3 report key. Supports both:
    1. Standardized: candidates/{email}/reports/{sap_id}_{module}_Attempt{attempt}_{YYYYMMDD_HHMMSS}_{session_id[:8]}.pdf
    2. Legacy:       candidates/{email}/reports/{YYYYMMDD_HHMMSS}_{session_id}.pdf
    """
    # Try standardized format first
    m = re.match(
        r"candidates/(?P<email>[^/]+)/reports/(?P<sap>[^_]+)_(?P<module>[^_]+)_Attempt(?P<attempt>\d+)_(?P<ts>\d{8}_\d{6})_(?P<session>[^.]+)\.pdf$",
        key
    )
    sap_id = ""
    module_name = ""
    attempt_num = 1

    if m:
        sap_id = m.group("sap")
        module_name = m.group("module")
        attempt_num = int(m.group("attempt"))
    else:
        # Fallback to legacy format
        m = re.match(
            r"candidates/(?P<email>[^/]+)/reports/(?P<ts>\d{8}_\d{6})_(?P<session>[^.]+)\.pdf$",
            key
        )
        if not m:
            return None

    ts_str = m.group("ts")
    try:
        ts_dt = datetime.datetime.strptime(ts_str, "%Y%m%d_%H%M%S")
        ist_dt = ts_dt + datetime.timedelta(hours=5, minutes=30)
        ts_display = ist_dt.strftime("%d %b %Y, %I:%M %p IST")
    except Exception:
        ts_display = ts_str

    email = m.group("email")
    name_from_email = email.split("@")[0].replace(".", " ").replace("_", " ").title()

    bond_year_val = 1
    if module_name:
        by_match = re.search(r"\d+", module_name)
        if by_match:
            bond_year_val = int(by_match.group(0))

    return {
        "email":            email,
        "candidate_name":   name_from_email,
        "session_id":       m.group("session"),
        "timestamp":        ts_str,
        "timestamp_display": ts_display,
        "s3_key":           key,
        "sap_id":           sap_id if sap_id != "SAPID_UNKNOWN" else "",
        "module":           module_name,
        "attempt_number":   attempt_num,
        "bond_year":        bond_year_val,
    }


security = HTTPBearer()


def _get_bond_year_for_session(session_id: str, session_bond_year_map: dict) -> int:
    import uuid
    clean_id = session_id.replace("-", "")
    # 1. Direct match
    if clean_id in session_bond_year_map:
        return session_bond_year_map[clean_id]
    # 2. Prefix match (e.g. first 8 chars)
    if clean_id[:8] in session_bond_year_map:
        return session_bond_year_map[clean_id[:8]]
    # 3. UUID5 match
    try:
        uuid_dns = uuid.uuid5(uuid.NAMESPACE_DNS, session_id)
        uuid_dns_str = str(uuid_dns).replace("-", "")
        if uuid_dns_str in session_bond_year_map:
            return session_bond_year_map[uuid_dns_str]
        if uuid_dns_str[:8] in session_bond_year_map:
            return session_bond_year_map[uuid_dns_str[:8]]
    except Exception:
        pass
    # 4. Default fallback
    return 1


@router.get("/list", summary="List all S3 interview assets grouped by candidate email")
async def list_s3_assets(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all real S3 videos and reports from bucket ai-interview-ajay-dev
    merged with local database sessions. Grouped by candidate org email.
    """
    from app.core.auth import get_current_hr_user
    await get_current_hr_user(credentials, db)
    token_str = credentials.credentials

    # ── Step 1: Query Local Database ──────────────────────────────────────────
    db_candidates = {}
    session_bond_year_map = {}
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.models import InterviewSession, Candidate, InterviewReport, InterviewAnalysis, SessionStatus
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from pathlib import Path

        stmt = (
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.candidate),
                selectinload(InterviewSession.report)
            )
            .join(Candidate, Candidate.id == InterviewSession.candidate_id)
            .outerjoin(InterviewReport, InterviewReport.session_id == InterviewSession.id)
            .where(InterviewSession.status == SessionStatus.COMPLETED)
        )
        res_db = await db.execute(stmt)
        db_sessions = res_db.scalars().all()

        for sess in db_sessions:
            cand = sess.candidate
            email = cand.email
            if not email:
                continue
            
            sess_id_str = str(sess.id).replace("-", "")
            session_bond_year_map[sess_id_str] = sess.bond_year or 1
            session_bond_year_map[sess_id_str[:8]] = sess.bond_year or 1

            if email not in db_candidates:
                join_dt = cand.join_date or datetime.datetime.now(datetime.timezone.utc)
                calc_module = cand.calculated_bond_year

                db_candidates[email] = {
                    "email":             email,
                    "sap_id":            cand.employee_id or "",
                    "candidate_name":    cand.display_name or email.split("@")[0].title(),
                    "join_date":         join_dt.strftime("%d %b %Y"),
                    "current_bond_year": calc_module,
                    "current_module":    f"Module {calc_module}",
                    "videos":           [],
                    "reports":          [],
                    "latest_video_url": None,
                    "latest_video_ts":  None,
                    "latest_report_url": None,
                    "total_size_mb":    0.0,
                }
            
            entry = db_candidates[email]
            session_id_str = str(sess.id)
            if sess.started_at:
                ist_dt = sess.started_at + datetime.timedelta(hours=5, minutes=30)
                ts_display = ist_dt.strftime("%d %b %Y, %I:%M %p IST")
                ts_str = ist_dt.strftime("%Y%m%d_%H%M%S")
            else:
                ts_display = "11 Aug 2026, 04:00 PM IST"
                ts_str = "20260811_160000"
            
            # Check local cache files
            local_video = Path("video_cache") / f"{session_id_str}.webm"
            video_size = round(local_video.stat().st_size / (1024 * 1024), 1) if local_video.exists() else 12.5
            
            local_pdf = Path("pdf_cache") / f"{session_id_str}.pdf"
            pdf_size = round(local_pdf.stat().st_size / 1024, 1) if local_pdf.exists() else 85.0

            video_url = sess.video_recording_url or f"/api/interview/serve-recording/{session_id_str}?token={token_str}"
            report_url = sess.report.pdf_url if (sess.report and sess.report.pdf_url) else f"/api/reports/serve/{session_id_str}?token={token_str}"
            
            # Only add if video file exists locally or in GCS/S3
            has_video = local_video.exists() or sess.video_recording_url
            if has_video:
                if not any(v["session_id"] == session_id_str for v in entry["videos"]):
                    entry["videos"].append({
                        "email":             email,
                        "candidate_name":    entry["candidate_name"],
                        "session_id":        session_id_str,
                        "timestamp":         ts_str,
                        "timestamp_display": ts_display,
                        "size_mb":           video_size,
                        "presign_url":       video_url,
                        "bond_year":         cand.calculated_bond_year,
                        "s3_key":            f"candidates/{email}/videos/{ts_str}_{session_id_str}.webm"
                    })
                    entry["total_size_mb"] = round(entry["total_size_mb"] + video_size, 1)
                    if entry["latest_video_url"] is None:
                        entry["latest_video_url"] = video_url
                        entry["latest_video_ts"]  = ts_display

            # Only add if report PDF exists locally or in GCS/S3
            has_report = local_pdf.exists() or (sess.report and sess.report.pdf_url)
            if has_report:
                if not any(r["session_id"] == session_id_str for r in entry["reports"]):
                    entry["reports"].append({
                        "email":             email,
                        "candidate_name":    entry["candidate_name"],
                        "session_id":        session_id_str,
                        "timestamp":         ts_str,
                        "timestamp_display": ts_display,
                        "size_kb":           pdf_size,
                        "presign_url":       report_url,
                        "bond_year":         cand.calculated_bond_year,
                        "s3_key":            f"candidates/{email}/reports/{ts_str}_{session_id_str}.pdf"
                    })
                    if entry["latest_report_url"] is None:
                        entry["latest_report_url"] = report_url

    except Exception as db_err:
        logger.error(f"Failed to load candidates from local database: {db_err}")

    # ── Step 2: Query AWS S3 ──────────────────────────────────────────────────
    videos: list[dict] = []
    reports: list[dict] = []
    profile_keys: dict[str, str] = {}  # email → profile key
    sap_map = {}
    name_map = {}

    try:
        s3 = _s3_client()
        paginator = s3.get_paginator("list_objects_v2")

        # List videos in candidates/ prefix
        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix="candidates/"):
            for obj in page.get("Contents", []):
                key  = obj["Key"]
                size = obj.get("Size", 0)

                if key.endswith("/profile.json"):
                    parts = key.split("/")
                    if len(parts) == 3:
                        profile_keys[parts[1]] = key
                    continue

                if not key.endswith(".webm") or size == 0:
                    continue
                parsed = _parse_video_key(key)
                if parsed:
                    parsed["size_mb"]      = round(size / (1024 * 1024), 1)
                    parsed["presign_url"]  = _presign(s3, key)
                    parsed["bond_year"]    = _get_bond_year_for_session(parsed["session_id"], session_bond_year_map)
                    videos.append(parsed)

        # List reports in candidates/ prefix
        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix="candidates/"):
            for obj in page.get("Contents", []):
                key  = obj["Key"]
                size = obj.get("Size", 0)
                if not key.endswith(".pdf") or size == 0:
                    continue
                parsed = _parse_report_key(key)
                if parsed:
                    parsed["size_kb"]      = round(size / 1024, 1)
                    parsed["presign_url"]  = _presign(s3, key)
                    parsed["bond_year"]    = _get_bond_year_for_session(parsed["session_id"], session_bond_year_map)
                    reports.append(parsed)

        # Read profiles from S3 for SAP mapping
        import json as _json
        join_date_map = {}
        bond_year_map = {}
        for email_folder, prof_key in profile_keys.items():
            try:
                resp = s3.get_object(Bucket=BUCKET_NAME, Key=prof_key)
                prof = _json.loads(resp["Body"].read().decode("utf-8"))
                sap_map[email_folder]  = prof.get("sap_id", "")
                name_map[email_folder] = prof.get("name", "")
                join_date_map[email_folder] = prof.get("join_date", "")
                bond_year_map[email_folder] = prof.get("current_bond_year", 1)
            except Exception:
                pass
    except Exception as s3_err:
        logger.warning(f"AWS S3 bucket query skipped/failed (falling back to database): {s3_err}")

    # ── Step 3: Merge S3 assets into db_candidates ────────────────────────────
    for vid in videos:
        email = vid["email"]
        if email not in db_candidates:
            sap_id = sap_map.get(email, "")
            name   = name_map.get(email, "") or vid["candidate_name"]
            join_date = join_date_map.get(email, "21 Aug 2026")
            by = bond_year_map.get(email, 1)
            db_candidates[email] = {
                "email":             email,
                "sap_id":            sap_id,
                "candidate_name":    name,
                "join_date":         join_date,
                "current_bond_year": by,
                "current_module":    f"Module {by}",
                "videos":           [],
                "reports":          [],
                "latest_video_url": None,
                "latest_video_ts":  None,
                "latest_report_url": None,
                "total_size_mb":    0.0,
            }
        entry = db_candidates[email]
        session_id_str = vid["session_id"]
        # Match S3 video to database session (supporting standard, prefix, and UUID5 matching)
        existing_vid = next(
            (v for v in entry["videos"] if _match_session_ids(session_id_str, v["session_id"])),
            None
        )
        if not existing_vid:
            entry["videos"].append(vid)
            entry["total_size_mb"] = round(entry["total_size_mb"] + vid["size_mb"], 1)
        else:
            # Overwrite presigned S3 url & align timestamps
            existing_vid["presign_url"] = vid["presign_url"]
            existing_vid["size_mb"]      = vid["size_mb"]
            existing_vid["timestamp"]   = vid["timestamp"]
            existing_vid["timestamp_display"] = vid["timestamp_display"]
            existing_vid["bond_year"]   = vid.get("bond_year", 1)
            existing_vid["s3_key"]      = vid["s3_key"]

    for rep in reports:
        email = rep["email"]
        if email not in db_candidates:
            sap_id = sap_map.get(email, "")
            name   = name_map.get(email, "") or rep["candidate_name"]
            join_date = join_date_map.get(email, "21 Aug 2026")
            by = bond_year_map.get(email, 1)
            db_candidates[email] = {
                "email":             email,
                "sap_id":            sap_id,
                "candidate_name":    name,
                "join_date":         join_date,
                "current_bond_year": by,
                "current_module":    f"Module {by}",
                "videos":           [],
                "reports":          [],
                "latest_video_url": None,
                "latest_video_ts":  None,
                "latest_report_url": None,
                "total_size_mb":    0.0,
            }
        entry = db_candidates[email]
        session_id_str = rep["session_id"]
        # Match S3 report to database session (supporting standard, prefix, and UUID5 matching)
        existing_rep = next(
            (r for r in entry["reports"] if _match_session_ids(session_id_str, r["session_id"])),
            None
        )
        if not existing_rep:
            entry["reports"].append(rep)
        else:
            # Overwrite presigned S3 url & align timestamps
            existing_rep["presign_url"] = rep["presign_url"]
            existing_rep["size_kb"]      = rep["size_kb"]
            existing_rep["timestamp"]   = rep["timestamp"]
            existing_rep["timestamp_display"] = rep["timestamp_display"]
            existing_rep["bond_year"]   = rep.get("bond_year", 1)
            existing_rep["s3_key"]      = rep["s3_key"]

    # Apply S3 profiles updates if any
    for email, entry in db_candidates.items():
        if email in sap_map and sap_map[email]:
            entry["sap_id"] = sap_map[email]
        if email in name_map and name_map[email]:
            entry["candidate_name"] = name_map[email]
        if email in join_date_map and join_date_map[email]:
            entry["join_date"] = join_date_map[email]
        
        # Determine correct bond year based on join_date
        by = entry["current_bond_year"]
        if email in bond_year_map and bond_year_map[email]:
            by = max(by, bond_year_map[email])
            
        # Recalculate using join_date to be absolutely certain it is wired according to DOJ
        if entry.get("join_date"):
            try:
                for fmt in ("%d %b %Y", "%Y-%m-%d"):
                    try:
                        join_dt = datetime.datetime.strptime(entry["join_date"], fmt)
                        if join_dt.tzinfo is None:
                            join_dt = join_dt.replace(tzinfo=datetime.timezone.utc)
                        now = datetime.datetime.now(datetime.timezone.utc)
                        diff_years = (now - join_dt).days / 365.25
                        calc_by = 1 if diff_years < 1.0 else int(diff_years) + 1
                        by = max(by, calc_by)
                        break
                    except Exception:
                        pass
            except Exception:
                pass
                
        entry["current_bond_year"] = by
        entry["current_module"] = f"Module {by}"
        
        # Align videos and reports for this candidate if not already tagged with specific module
        for v in entry["videos"]:
            if not v.get("bond_year"):
                v["bond_year"] = by
        for r in entry["reports"]:
            if not r.get("bond_year"):
                r["bond_year"] = by
        
        # Sort files chronologically newest first
        entry["videos"].sort(key=lambda x: x["timestamp"], reverse=True)
        entry["reports"].sort(key=lambda x: x["timestamp"], reverse=True)
        
        if entry["videos"]:
            entry["latest_video_url"] = entry["videos"][0]["presign_url"]
            entry["latest_video_ts"]  = entry["videos"][0]["timestamp_display"]
        if entry["reports"]:
            entry["latest_report_url"] = entry["reports"][0]["presign_url"]

    candidate_list = sorted(db_candidates.values(), key=lambda c: c["email"])

    return {
        "candidates":    candidate_list,
        "total_videos":  sum(len(c["videos"]) for c in candidate_list),
        "total_reports": sum(len(c["reports"]) for c in candidate_list),
        "bucket":        BUCKET_NAME,
        "structure":     "candidates/{email}/videos|reports/{ts}_{sid}.webm|pdf",
    }


@router.delete("/purge-all", summary="Purge all existing reports, recordings, and candidate profiles")
async def purge_all_assets(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """
    Purges all existing reports, recordings, and profiles from:
    1. AWS S3 bucket (candidates/ prefix)
    2. Local file caches (pdf_cache, video_cache, recordings)
    3. Database records (InterviewReport, AnalysisResult, SessionCognitiveQuestion, SessionPsychometricQuestion, CandidateResponse, SessionQuestion, InterviewSession, Candidate)
    Leaves the system clean for fresh testing with dynamic naming format.
    """
    from app.core.auth import get_current_hr_user
    from app.models.models import (
        InterviewReport, AnalysisResult, SessionCognitiveQuestion,
        SessionPsychometricQuestion, CandidateResponse, SessionQuestion,
        InterviewSession, Candidate
    )
    from sqlalchemy import delete
    import shutil
    from pathlib import Path

    await get_current_hr_user(credentials, db)

    # 1. Delete from AWS S3
    deleted_s3 = 0
    try:
        s3 = _s3_client()
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix="candidates/"):
            contents = page.get("Contents", [])
            if contents:
                delete_objs = [{"Key": obj["Key"]} for obj in contents]
                s3.delete_objects(Bucket=BUCKET_NAME, Delete={"Objects": delete_objs})
                deleted_s3 += len(delete_objs)
    except Exception as s3_err:
        logger.warning(f"S3 purge error: {s3_err}")

    # 2. Delete local file caches
    for folder in ("pdf_cache", "video_cache", "recordings"):
        p = Path(folder)
        if p.exists():
            for item in p.iterdir():
                try:
                    if item.is_file():
                        item.unlink()
                    elif item.is_dir():
                        shutil.rmtree(item)
                except Exception:
                    pass

    # 3. Clean DB tables
    deleted_db = 0
    try:
        await db.execute(delete(InterviewReport))
        await db.execute(delete(AnalysisResult))
        await db.execute(delete(SessionCognitiveQuestion))
        await db.execute(delete(SessionPsychometricQuestion))
        await db.execute(delete(CandidateResponse))
        await db.execute(delete(SessionQuestion))
        await db.execute(delete(InterviewSession))
        await db.execute(delete(Candidate))
        await db.commit()
        deleted_db = 1
    except Exception as db_err:
        logger.warning(f"Database purge error: {db_err}")
        await db.rollback()

    return {
        "status": "success",
        "message": "All reports, recordings, and profiles purged successfully.",
        "s3_objects_deleted": deleted_s3,
        "db_cleared": bool(deleted_db)
    }

