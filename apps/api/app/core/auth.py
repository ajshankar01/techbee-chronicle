"""
Microsoft Teams SSO Authentication
Validates JWT tokens issued by Azure AD via Teams SSO
"""
import httpx
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from typing import Optional, Any

from app.core.config import settings
from app.core.database import get_db
from app.models.models import HRUser, Candidate, UserRole

security = HTTPBearer()

# ── JWKS Client (caches Microsoft's public keys) ──────────────────────────────
_jwks_client = PyJWKClient(
    uri=f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}/discovery/v2.0/keys",
    cache_jwk_set=True,
    lifespan=3600,
)


def decode_teams_token(token: str) -> dict:
    """Decode and validate a Microsoft Teams SSO JWT token"""
    # SECURITY: dev-token or invite token bypass allowed in non-production or for scheduled candidate links
    if (settings.APP_ENV == "development" or not settings.AZURE_CLIENT_ID or settings.AZURE_CLIENT_ID.startswith("0000")) and (token.startswith("dev-token") or token == "dev-token"):
        email = "ajay.shankar@hcltech.com"
        name = "Ajay Shankar"
        role = "hr_manager"

        # Support dev-token:email and dev-token:email:role formats for local testing
        if ":" in token:
            parts = token.split(":")
            if len(parts) >= 2 and "@" in parts[1]:
                email = parts[1].strip()
                name = email.split("@")[0].capitalize()
            if len(parts) >= 3:
                role = parts[2].strip()

        import hashlib
        h = hashlib.md5(email.encode("utf-8")).hexdigest()
        deterministic_oid = f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"

        return {
            "oid": deterministic_oid,
            "upn": email,
            "name": name,
            "email": email,
            "roles": [role],
        }

    # If token is a raw string without standard JWT dots, treat as candidate access token
    if "." not in token:
        import hashlib
        h = hashlib.md5(token.encode("utf-8")).hexdigest()
        token_oid = f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"
        return {
            "oid": token_oid,
            "upn": f"candidate_{h[:8]}@hcltech.com",
            "name": "Candidate",
            "email": f"candidate_{h[:8]}@hcltech.com",
            "roles": ["candidate"],
            "raw_token": token,
        }

    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.AZURE_CLIENT_ID,
            options={"verify_exp": True},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please refresh your Teams session.",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
        )


async def get_current_hr_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> HRUser:
    """FastAPI dependency — validates Teams token and returns HR user"""
    payload = decode_teams_token(credentials.credentials)

    azure_oid = payload.get("oid")
    if not azure_oid:
        raise HTTPException(status_code=401, detail="Invalid token: missing user identity")

    roles = payload.get("roles", [])
    if "candidate" in roles:
        raise HTTPException(
            status_code=403,
            detail="Access denied: Candidates are not permitted to access HR resources."
        )

    # Look up or auto-provision HR user from Teams identity
    result = await db.execute(select(HRUser).where(HRUser.azure_oid == azure_oid))
    hr_user = result.scalar_one_or_none()

    if not hr_user:
        # SECURITY: Restrict auto-provisioning to the configured corporate domain.
        # Prevents AZURE_TENANT_ID=common from granting any MS account HR access.
        email = payload.get("upn") or payload.get("email", "")
        allowed_domain = settings.ALLOWED_HR_DOMAIN  # default: "hcltech.com"
        if allowed_domain and not email.lower().endswith(f"@{allowed_domain.lower()}"):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: Only @{allowed_domain} accounts may access HR resources."
            )
        # Auto-provision on first login (Teams identity is trusted)
        hr_user = HRUser(
            azure_oid=azure_oid,
            email=email,
            display_name=payload.get("name", "HR User"),
            role=UserRole.HR_MANAGER,
        )
        db.add(hr_user)
        await db.commit()
        await db.refresh(hr_user)

    if not hr_user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been deactivated.")

    return hr_user


async def get_current_candidate(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Candidate:
    """FastAPI dependency — validates Teams token and returns Candidate"""
    payload = decode_teams_token(credentials.credentials)

    azure_oid = payload.get("oid")
    if not azure_oid:
        raise HTTPException(status_code=401, detail="Invalid token: missing user identity")

    result = await db.execute(select(Candidate).where(Candidate.azure_oid == azure_oid))
    candidate = result.scalar_one_or_none()

    # If raw_token present from invite link, try matching candidate from session notes
    raw_token = payload.get("raw_token")
    if not candidate and raw_token:
        try:
            sess_res = await db.execute(
                select(InterviewSession, Candidate)
                .join(Candidate, InterviewSession.candidate_id == Candidate.id)
                .where(InterviewSession.notes.like(f"%{raw_token}%"))
            )
            sess_row = sess_res.first()
            if sess_row:
                candidate = sess_row[1]
                if candidate:
                    candidate.azure_oid = azure_oid
                    await db.commit()
                    await db.refresh(candidate)
        except Exception:
            pass

    if not candidate:
        # Fallback: check if candidate already exists by email (e.g. registered by HR first)
        email = payload.get("email") or payload.get("upn", "")
        if email:
            email_res = await db.execute(select(Candidate).where(Candidate.email == email))
            candidate = email_res.scalar_one_or_none()
            if candidate:
                # Update the existing candidate's azure_oid to match the token identity
                candidate.azure_oid = azure_oid
                await db.commit()
                await db.refresh(candidate)

    if not candidate:
        # Auto-provision candidate on first access
        candidate = Candidate(
            azure_oid=azure_oid,
            email=payload.get("upn") or payload.get("email", ""),
            display_name=payload.get("name", "Candidate"),
        )
        db.add(candidate)
        await db.commit()
        await db.refresh(candidate)

    return candidate


def require_super_admin(current_user: HRUser = Depends(get_current_hr_user)) -> HRUser:
    """Dependency — ensures user has Super Admin role"""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return current_user


async def get_current_user_flexible(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Flexible dependency — returns either Candidate or HRUser depending on token role"""
    payload = decode_teams_token(credentials.credentials)
    azure_oid = payload.get("oid")
    if not azure_oid:
        raise HTTPException(status_code=401, detail="Invalid token: missing user identity")

    roles = payload.get("roles", [])
    is_candidate = "candidate" in roles

    if is_candidate:
        # Look up or auto-provision Candidate
        result = await db.execute(select(Candidate).where(Candidate.azure_oid == azure_oid))
        candidate = result.scalar_one_or_none()
        if not candidate:
            candidate = Candidate(
                azure_oid=azure_oid,
                email=payload.get("upn") or payload.get("email", ""),
                display_name=payload.get("name", "Candidate"),
            )
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)
        return candidate
    else:
        # Look up or auto-provision HRUser
        result = await db.execute(select(HRUser).where(HRUser.azure_oid == azure_oid))
        hr_user = result.scalar_one_or_none()
        if not hr_user:
            hr_user = HRUser(
                azure_oid=azure_oid,
                email=payload.get("upn") or payload.get("email", ""),
                display_name=payload.get("name", "HR User"),
                role=UserRole.HR_MANAGER,
            )
            db.add(hr_user)
            await db.commit()
            await db.refresh(hr_user)
        if not hr_user.is_active:
            raise HTTPException(status_code=403, detail="Your account has been deactivated.")
        return hr_user


# ── Dependency Aliases for Router Compatibility ─────────────────────────────
get_current_user = get_current_user_flexible
require_hr = get_current_hr_user
CurrentUser = Any

