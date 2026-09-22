"""
AWS S3 Storage Service â€” Fresher Interview Platform
Email-based folder structure for 1000 organisation-email candidates.

S3 Key Patterns:
  Video:  candidates/{email}/videos/{YYYYMMDD_HHMMSS}_{session_id[:8]}.webm
  Report: candidates/{email}/reports/{YYYYMMDD_HHMMSS}_{session_id[:8]}.pdf

Bucket: ai-interview-ajay-dev (ap-southeast-2)  |  Retention: 7 years
"""
import logging
import re
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Union

import boto3

from app.core.config import settings

logger = logging.getLogger(__name__)

_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            _s3_client = boto3.client(
                "s3",
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
        else:
            _s3_client = boto3.client("s3", region_name=settings.AWS_REGION)
    return _s3_client


def ensure_buckets_exist():
    """
    Verifies AWS S3 Bucket and configures 7-Year Retention Policy
    for the new email-based candidates/ folder structure.
    """
    try:
        s3 = _get_s3_client()
        s3.head_bucket(Bucket=settings.AWS_S3_BUCKET_NAME)
        logger.info(f"âœ… AWS S3 Bucket '{settings.AWS_S3_BUCKET_NAME}' in '{settings.AWS_REGION}' verified active!")

        # 7-Year Corporate Compliance Lifecycle for candidates/ prefix
        try:
            s3.put_bucket_lifecycle_configuration(
                Bucket=settings.AWS_S3_BUCKET_NAME,
                LifecycleConfiguration={
                    "Rules": [
                        {
                            "ID": "7-Year-Candidate-Videos-Glacier",
                            "Status": "Enabled",
                            "Filter": {"Prefix": "candidates/"},
                            "Expiration": {"Days": 2555},  # 7 Years
                            "Transitions": [
                                {
                                    "Days": 30,  # Videos â†’ Glacier after 30 days
                                    "StorageClass": "GLACIER",
                                }
                            ],
                        }
                    ]
                },
            )
            logger.info("âœ… AWS S3 7-Year Retention & Glacier Compliance Policy Configured!")
        except Exception as l_err:
            logger.info(f"S3 Lifecycle Policy status: {l_err}")

        # CORS â€” allow browser PUT for direct uploads
        try:
            s3.put_bucket_cors(
                Bucket=settings.AWS_S3_BUCKET_NAME,
                CORSConfiguration={
                    "CORSRules": [
                        {
                            "AllowedHeaders": ["*"],
                            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
                            "AllowedOrigins": ["*"],
                            "ExposeHeaders": ["ETag", "Content-Length"],
                            "MaxAgeSeconds": 3600,
                        }
                    ]
                },
            )
            logger.info("âœ… AWS S3 CORS policy configured (allows PUT from browser)")
        except Exception as cors_err:
            logger.info(f"S3 CORS config status: {cors_err}")

    except Exception as e:
        logger.info(f"AWS S3 Bucket check status: {e}")


def _email_to_folder(email: str) -> str:
    """
    Normalise org email for use as an S3 folder name.
    S3 keys support @, ., - natively so we keep the email mostly as-is,
    only replacing whitespace and truly unsafe chars with underscores.
    e.g.  ajay.shankar@techbee.in  â†’  ajay.shankar@techbee.in
    Falls back to 'unknown@fresher.in' if blank.
    """
    email = (email or "unknown@fresher.in").strip().lower()
    safe = re.sub(r"[^\w@.\-+]", "_", email)
    return safe


def upsert_candidate_profile(
    candidate_email: str,
    sap_id: str,
    candidate_name: str,
) -> None:
    """
    Write/update candidates/{email}/profile.json in S3.
    Contains { email, sap_id, name } so the HR portal can search/filter
    by SAP ID even though the folder key is the org email.
    This is a no-op (safe to call repeatedly) â€” latest values win.
    """
    import json
    email_folder = _email_to_folder(candidate_email)
    profile_key = f"candidates/{email_folder}/profile.json"
    profile = {
        "email": candidate_email,
        "sap_id": sap_id or "",
        "name": candidate_name or "",
    }
    try:
        s3 = _get_s3_client()
        s3.put_object(
            Bucket=settings.AWS_S3_BUCKET_NAME,
            Key=profile_key,
            Body=json.dumps(profile, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json",
            Metadata={
                "candidate_email": candidate_email,
                "sap_id": sap_id or "",
                "candidate_name": candidate_name or "",
            },
        )
        logger.info(f"âœ… Candidate profile upserted â†’ {profile_key}")
    except Exception as e:
        logger.warning(f"Failed to upsert candidate profile: {e}")


def _clean_str(val: str, fallback: str = "") -> str:
    """Clean string for safe S3 path usage (letters, digits, underscore, dash, dot)."""
    s = (val or fallback).strip()
    return re.sub(r"[^\w.\-+]", "_", s)


async def upload_session_recording(
    session_id: str,
    video_bytes: Optional[bytes] = None,
    candidate_email: str = "unknown@fresher.in",
    candidate_name: str = "Fresher Candidate",
    sap_id: str = "",
    module_name: str = "Module_1",
    attempt_number: int = 1,
    content_type: str = "video/webm",
    file_path: Optional[Path] = None,
) -> str:
    """
    Upload interview video recording to S3 using standardized convention:
    candidates/{email}/videos/{sap_id}_{module_name}_Attempt{attempt}_{YYYYMMDD_HHMMSS}_{session_id[:8]}.webm
    Supports uploading directly from disk via file_path to prevent memory blowups on 512MB RAM containers.
    """
    now = datetime.now(timezone.utc)
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")
    email_folder = _email_to_folder(candidate_email)
    clean_sap = _clean_str(sap_id, "SAPID_UNKNOWN")
    clean_module = _clean_str(module_name, "Module_1")
    short_session = session_id[:8] if session_id else "session"
    filename = f"{clean_sap}_{clean_module}_Attempt{attempt_number}_{timestamp_str}_{short_session}.webm"
    object_key = f"candidates/{email_folder}/videos/{filename}"

    metadata = {
        "session_id": session_id,
        "candidate_email": candidate_email,
        "candidate_name": candidate_name,
        "sap_id": sap_id or "",
        "module": clean_module,
        "attempt_number": str(attempt_number),
        "uploaded_at": now.isoformat(),
        "retention_policy": "7_years_compliance",
    }

    def _upload():
        try:
            s3 = _get_s3_client()
            if file_path and Path(file_path).exists():
                # Stream directly from disk file without loading whole video into RAM
                s3.upload_file(
                    Filename=str(file_path),
                    Bucket=settings.AWS_S3_BUCKET_NAME,
                    Key=object_key,
                    ExtraArgs={
                        "ContentType": content_type,
                        "Metadata": metadata,
                    },
                )
            else:
                s3.put_object(
                    Bucket=settings.AWS_S3_BUCKET_NAME,
                    Key=object_key,
                    Body=video_bytes or b"",
                    ContentType=content_type,
                    Metadata=metadata,
                )
            # Generate a 7-day presigned GET URL so HR portal has an immediate working link
            try:
                s3_url = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": settings.AWS_S3_BUCKET_NAME, "Key": object_key},
                    ExpiresIn=604800,  # 7 days
                )
            except Exception as presign_err:
                logger.warning(f"Presign failed during upload, using direct fallback: {presign_err}")
                s3_url = (
                    f"https://{settings.AWS_S3_BUCKET_NAME}.s3."
                    f"{settings.AWS_REGION}.amazonaws.com/{object_key}"
                )
            logger.info(f"⚡ S3 Video Uploaded & Presigned → {object_key}")
            return s3_url
        except Exception as e:
            logger.warning(f"S3 upload failed, falling back to local: {e}")
            local_dir = Path("recordings") / email_folder
            local_dir.mkdir(parents=True, exist_ok=True)
            target_path = local_dir / filename
            if file_path and Path(file_path).exists() and file_path != target_path:
                import shutil
                shutil.copyfile(str(file_path), str(target_path))
            elif video_bytes:
                target_path.write_bytes(video_bytes)
            logger.info(f"💾 Saved locally: {target_path}")
            return str(target_path)

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _upload)


async def upload_report_pdf(
    session_id: str,
    pdf_bytes: bytes,
    candidate_email: str = "unknown@fresher.in",
    candidate_name: str = "Fresher Candidate",
    sap_id: str = "",
    module_name: str = "Module_1",
    attempt_number: int = 1,
) -> str:
    """
    Upload PDF evaluation report to S3 using standardized convention:
    candidates/{email}/reports/{sap_id}_{module_name}_Attempt{attempt}_{YYYYMMDD_HHMMSS}_{session_id[:8]}.pdf
    Each attempt produces an explicit numbered file — no overwriting.
    """
    now = datetime.now(timezone.utc)
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")
    email_folder = _email_to_folder(candidate_email)
    clean_sap = _clean_str(sap_id, "SAPID_UNKNOWN")
    clean_module = _clean_str(module_name, "Module_1")
    short_session = session_id[:8] if session_id else "session"
    filename = f"{clean_sap}_{clean_module}_Attempt{attempt_number}_{timestamp_str}_{short_session}.pdf"
    object_key = f"candidates/{email_folder}/reports/{filename}"

    def _upload():
        try:
            s3 = _get_s3_client()
            s3.put_object(
                Bucket=settings.AWS_S3_BUCKET_NAME,
                Key=object_key,
                Body=pdf_bytes,
                ContentType="application/pdf",
                Metadata={
                    "session_id": session_id,
                    "candidate_email": candidate_email,
                    "candidate_name": candidate_name,
                    "sap_id": sap_id or "",
                    "module": clean_module,
                    "attempt_number": str(attempt_number),
                    "interviewed_at": now.isoformat(),
                    "report_timestamp": timestamp_str,
                    "retention_policy": "7_years_compliance",
                },
            )
            # Generate a 7-day presigned GET URL for the PDF
            try:
                s3_url = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": settings.AWS_S3_BUCKET_NAME, "Key": object_key},
                    ExpiresIn=604800,  # 7 days (maximum expiration for IAM)
                )
            except Exception as presign_err:
                logger.warning(f"Presign failed during report upload, using direct fallback: {presign_err}")
                s3_url = (
                    f"https://{settings.AWS_S3_BUCKET_NAME}.s3."
                    f"{settings.AWS_REGION}.amazonaws.com/{object_key}"
                )
            logger.info(f"⚡ S3 PDF Report Uploaded & Presigned → {object_key}")
            return s3_url
        except Exception as e:
            logger.warning(f"S3 PDF upload failed, falling back to local: {e}")
            local_dir = Path("reports") / email_folder
            local_dir.mkdir(parents=True, exist_ok=True)
            file_path = local_dir / filename
            file_path.write_bytes(pdf_bytes)
            return str(file_path)

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _upload)


async def get_signed_recording_url(
    session_id: str,
    candidate_email: str = "unknown@fresher.in",
    candidate_name: str = "Fresher Candidate",
    expiry_hours: int = 2,
) -> str:
    """
    Generate a presigned S3 URL for HR to stream a candidate's video.
    Finds the most recent video under candidates/{email}/videos/.
    """
    email_folder = _email_to_folder(candidate_email)

    def _generate():
        try:
            s3 = _get_s3_client()
            prefix = f"candidates/{email_folder}/videos/"
            resp = s3.list_objects_v2(Bucket=settings.AWS_S3_BUCKET_NAME, Prefix=prefix)
            contents = resp.get("Contents", [])

            if not contents:
                return (
                    f"https://{settings.AWS_S3_BUCKET_NAME}.s3."
                    f"{settings.AWS_REGION}.amazonaws.com/"
                    f"candidates/{email_folder}/videos/{session_id}.webm"
                )

            target_key = sorted(contents, key=lambda x: x["LastModified"], reverse=True)[0]["Key"]
            url = s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.AWS_S3_BUCKET_NAME, "Key": target_key},
                ExpiresIn=expiry_hours * 3600,
            )
            return url
        except Exception as e:
            logger.warning(f"Presigned URL generation failed: {e}")
            return (
                f"https://{settings.AWS_S3_BUCKET_NAME}.s3."
                f"{settings.AWS_REGION}.amazonaws.com/"
                f"candidates/{email_folder}/videos/{session_id}.webm"
            )

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _generate)

