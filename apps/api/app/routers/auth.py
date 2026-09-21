"""
Auth Router — Microsoft Teams SSO + Role Management
Handles user provisioning, token validation, and role assignment
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user, CurrentUser
from app.models.models import HRUser, Candidate

router = APIRouter(prefix="/api/auth", tags=["auth"])


class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    department: str | None = None
    is_active: bool
    current_bond_year: int | None = 1
    sap_id: str | None = None


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(
    name: str | None = None,
    bond_year: int | None = None,
    join_date: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the currently authenticated user's profile and role.
    Called by the frontend on every boot to determine if HR or Candidate.
    """
    # 1. If flexible check returned Candidate, look up candidate first
    # Otherwise check HRUser first, then Candidate
    is_candidate_type = hasattr(current_user, '__tablename__') and current_user.__tablename__ == 'candidates'
    
    if is_candidate_type:
        result = await db.execute(
            select(Candidate).where(Candidate.azure_oid == current_user.azure_oid)
        )
        candidate = result.scalar_one_or_none()
        
        if candidate:
            changed = False
            if name and name != candidate.display_name:
                candidate.display_name = name
                changed = True
            if bond_year is not None and bond_year != candidate.current_bond_year:
                candidate.current_bond_year = bond_year
                changed = True
            if join_date:
                from datetime import datetime
                try:
                    parsed_date = datetime.strptime(join_date, "%Y-%m-%d")
                    # SQLite works with date/datetime objects directly
                    if candidate.join_date != parsed_date:
                        candidate.join_date = parsed_date
                        changed = True
                except Exception as e:
                    print(f"Error parsing join_date in auth.py: {e}")
            if changed:
                await db.commit()
                await db.refresh(candidate)

            return UserProfileResponse(
                id=str(candidate.id),
                email=candidate.email,
                name=candidate.display_name or candidate.email,
                role="candidate",
                is_active=candidate.is_active,
                current_bond_year=candidate.calculated_bond_year,
                sap_id=candidate.employee_id,
            )

    # 2. Check if HRUser exists
    result = await db.execute(
        select(HRUser).where(HRUser.email == current_user.email)
    )
    hr_user = result.scalar_one_or_none()

    if hr_user:
        return UserProfileResponse(
            id=str(hr_user.id),
            email=hr_user.email,
            name=hr_user.display_name or hr_user.email,
            role=hr_user.role.value if hasattr(hr_user.role, 'value') else str(hr_user.role),
            department=None,
            is_active=hr_user.is_active,
            current_bond_year=1,
            sap_id=None,
        )

    # 3. Fallback check for Candidate if not already matched
    if not is_candidate_type:
        result = await db.execute(
            select(Candidate).where(Candidate.azure_oid == current_user.azure_oid)
        )
        candidate = result.scalar_one_or_none()

        if candidate:
            changed = False
            if name and name != candidate.display_name:
                candidate.display_name = name
                changed = True
            if bond_year is not None and bond_year != candidate.current_bond_year:
                candidate.current_bond_year = bond_year
                changed = True
            if join_date:
                from datetime import datetime
                try:
                    parsed_date = datetime.strptime(join_date, "%Y-%m-%d")
                    if candidate.join_date != parsed_date:
                        candidate.join_date = parsed_date
                        changed = True
                except Exception as e:
                    print(f"Error parsing join_date in auth.py: {e}")
            if changed:
                await db.commit()
                await db.refresh(candidate)

            return UserProfileResponse(
                id=str(candidate.id),
                email=candidate.email,
                name=candidate.display_name or candidate.email,
                role="candidate",
                is_active=candidate.is_active,
                current_bond_year=candidate.calculated_bond_year,
                sap_id=candidate.employee_id,
            )

    # fallback — return current_user info (auto-provisioned HR)
    return UserProfileResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.display_name or current_user.email,
        role=current_user.role.value if hasattr(current_user.role, 'value') else "hr_manager",
        is_active=current_user.is_active,
        current_bond_year=1,
        sap_id=None,
    )


class ProvisionHRRequest(BaseModel):
    email: str
    full_name: str
    role: str = "hr_manager"
    department: str | None = None


@router.post("/provision/hr")
async def provision_hr_user(
    body: ProvisionHRRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # FIX-3: Compare against the enum value, not a raw string.
    # Before this fix, UserRole.SUPER_ADMIN != "super_admin" was always True,
    # meaning any HR user could call this super-admin endpoint.
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role not in ("super_admin",):
        raise HTTPException(status_code=403, detail="Super admin access required")

    result = await db.execute(select(HRUser).where(HRUser.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="HR user already exists")

    hr_user = HRUser(
        email=body.email,
        display_name=body.full_name,  # HRUser model uses display_name
        role=body.role,
        department=body.department,
    )
    db.add(hr_user)
    await db.commit()
    await db.refresh(hr_user)
    return {"success": True, "id": str(hr_user.id)}


class ProvisionCandidateRequest(BaseModel):
    email: str
    full_name: str
    batch_id: str | None = None
    teams_user_id: str


@router.post("/provision/candidate")
async def provision_candidate(
    body: ProvisionCandidateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # FIX-3: Use enum-aware role comparison
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role not in ("hr_manager", "super_admin"):
        raise HTTPException(status_code=403, detail="HR access required")

    result = await db.execute(select(Candidate).where(Candidate.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Candidate already exists")

    candidate = Candidate(
        email=body.email,
        # FIX-4: Candidate model uses display_name, not full_name.
        # Before this fix, this endpoint always raised AttributeError.
        display_name=body.full_name,
        azure_oid=body.teams_user_id,
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    return {"success": True, "id": str(candidate.id)}

