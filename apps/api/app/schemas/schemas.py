from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
import uuid

# ── Auth ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserInfo(BaseModel):
    id: str
    email: str
    name: str
    role: str
    department: Optional[str] = None
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


# ── HR ────────────────────────────────────────────────────────────────────────
class CandidateCreate(BaseModel):
    email: str
    full_name: str
    teams_user_id: str
    batch_year: Optional[int] = None
    employee_id: Optional[str] = None

class CandidateResponse(BaseModel):
    id: str
    name: str
    email: str
    batch_year: Optional[int] = None
    employee_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CandidateListResponse(BaseModel):
    candidates: List[CandidateResponse]

class SessionCreate(BaseModel):
    candidate_id: str
    scheduled_at: Optional[datetime] = None

class SessionListResponse(BaseModel):
    sessions: List[Dict[str, Any]]


# ── Interview ─────────────────────────────────────────────────────────────────
class SessionCreateRequest(BaseModel):
    candidate_id: str

class SessionStatusResponse(BaseModel):
    session_id: str
    status: str

class AnswerSubmit(BaseModel):
    question_id: str
    audio_url: Optional[str] = None
    transcript: Optional[str] = None
    duration_seconds: Optional[float] = None

class QuestionResponse(BaseModel):
    id: str
    question_text: str
    question_type: str
    audio_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class InterviewCompleteResponse(BaseModel):
    session_id: str
    status: str
    message: str


# ── Analysis ──────────────────────────────────────────────────────────────────
class AnalysisRequest(BaseModel):
    session_id: str

class ScoreBreakdown(BaseModel):
    vision_alignment: float
    emotional_intelligence: float
    stress_tolerance: float
    adaptability: float
    team_collaboration: float
    ethical_decision_making: float
    eye_contact: float
    body_language: float

class AnalysisResponse(BaseModel):
    overall_score: float
    mindset_label: str
    scores: ScoreBreakdown
    strengths: List[str]
    areas_of_improvement: List[str]


# ── Reports ───────────────────────────────────────────────────────────────────
class ReportResponse(BaseModel):
    session_id: str
    pdf_url: Optional[str] = None
    transcript: Any = None

class ReportListResponse(BaseModel):
    reports: List[ReportResponse]

class RecordingUrlResponse(BaseModel):
    url: str


# ── Questions ─────────────────────────────────────────────────────────────────
class QuestionBankCreate(BaseModel):
    question_type: str
    question_text: str
    tags: Optional[Dict[str, str]] = None

class QuestionBankResponse(BaseModel):
    id: str
    question_type: str
    question_text: str
    tags: Optional[Dict[str, str]] = None
    model_config = ConfigDict(from_attributes=True)


# ── WebSocket ─────────────────────────────────────────────────────────────────
class WSMessage(BaseModel):
    type: str
    payload: Any

class WSEvent(BaseModel):
    event_type: str
    data: Any
