"""
SQLAlchemy ORM Models — All database tables
"""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, Integer, Float, Boolean, DateTime,
    ForeignKey, Enum, JSON, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    HR_MANAGER = "hr_manager"
    CANDIDATE = "candidate"


class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    FLAGGED = "flagged"


class QuestionType(str, enum.Enum):
    PSYCHOMETRIC = "psychometric"
    ENDURANCE = "endurance"
    COGNITIVE_ABILITY = "cognitive_ability"
    FORENSIC_ANALYSIS = "forensic_analysis"
    ADAPTABILITY = "adaptability"
    COMMUNICATION = "communication"
    TEAM_MANAGEMENT = "team_management"
    LEADERSHIP_QUALITY = "leadership_quality"
    VISION_AND_MISSION = "vision_and_mission"
    STRATEGIC_THINKING = "strategic_thinking"
    FOLLOWUP = "followup"


class QuestionSource(str, enum.Enum):
    HR_DEFINED = "hr_defined"
    AI_GENERATED = "ai_generated"
    QUESTION_BANK = "question_bank"


class ViolationType(str, enum.Enum):
    TAB_SWITCH = "tab_switch"
    FULLSCREEN_EXIT = "fullscreen_exit"
    MULTIPLE_FACES = "multiple_faces"
    SECONDARY_DEVICE = "secondary_device"
    COPY_PASTE = "copy_paste"
    DEVTOOLS_OPEN = "devtools_open"


class CognitiveDomain(str, enum.Enum):
    NUMERICAL = "NUMERICAL"
    LOGICAL = "LOGICAL"
    VERBAL = "VERBAL"
    PATTERN = "PATTERN"
    PROCESSING = "PROCESSING"
    ATTENTION = "ATTENTION"
    ABSTRACT = "ABSTRACT"

class QuestionDifficulty(str, enum.Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"

class QuestionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    AI_VALIDATED = "AI_VALIDATED"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    PILOT = "PILOT"
    ACTIVE = "ACTIVE"
    MONITORED = "MONITORED"
    RETIRED = "RETIRED"


# ── Models ────────────────────────────────────────────────────────────────────

class HRUser(Base):
    """HR Managers and Super Admins — authenticated via Teams SSO"""
    __tablename__ = "hr_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    azure_oid: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)  # Azure AD Object ID
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.HR_MANAGER, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    created_sessions: Mapped[list["InterviewSession"]] = relationship("InterviewSession", back_populates="created_by_hr")


class Candidate(Base):
    """TechBee candidates taking the interview"""
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    azure_oid: Mapped[Optional[str]] = mapped_column(String(256), unique=True, nullable=True, index=True)  # Teams identity
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(256), nullable=False)
    batch_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    employee_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    join_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    current_bond_year: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    sessions: Mapped[list["InterviewSession"]] = relationship("InterviewSession", back_populates="candidate")

    @property
    def full_name(self) -> str:
        return self.display_name or ""

    @property
    def calculated_bond_year(self) -> int:
        from datetime import datetime, timezone
        join_dt = self.join_date
        if not join_dt:
            return self.current_bond_year or 1
        if join_dt.tzinfo is None:
            join_dt = join_dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        diff_years = (now - join_dt).days / 365.25
        calc_year = 1 if diff_years < 1.0 else int(diff_years) + 1
        return max(self.current_bond_year or 1, calc_year)


class QuestionBank(Base):
    """Pre-loaded question bank (HR-defined or seeded)"""
    __tablename__ = "question_bank"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # e.g. {"domain": "tech", "difficulty": "medium"}
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("hr_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InterviewSession(Base):
    """An individual interview session for a candidate"""
    __tablename__ = "interview_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    created_by_hr_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hr_users.id"), nullable=False)
    status: Mapped[SessionStatus] = mapped_column(Enum(SessionStatus), default=SessionStatus.PENDING, nullable=False)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    video_recording_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)  # GCS URL
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # HR notes
    bond_year: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    parent_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="sessions")
    created_by_hr: Mapped["HRUser"] = relationship("HRUser", back_populates="created_sessions")
    questions: Mapped[list["SessionQuestion"]] = relationship("SessionQuestion", back_populates="session", order_by="SessionQuestion.order_index")
    responses: Mapped[list["CandidateResponse"]] = relationship("CandidateResponse", back_populates="session")
    analysis_result: Mapped[Optional["AnalysisResult"]] = relationship("AnalysisResult", back_populates="session", uselist=False)
    report: Mapped[Optional["InterviewReport"]] = relationship("InterviewReport", back_populates="session", uselist=False)
    violations: Mapped[list["ProctoringViolation"]] = relationship("ProctoringViolation", back_populates="session")
    cognitive_questions: Mapped[list["SessionCognitiveQuestion"]] = relationship("SessionCognitiveQuestion", back_populates="session", order_by="SessionCognitiveQuestion.order_index")
    psychometric_questions: Mapped[list["SessionPsychometricQuestion"]] = relationship("SessionPsychometricQuestion", back_populates="session", order_by="SessionPsychometricQuestion.order_index")


class SessionQuestion(Base):
    """Questions assigned to a specific interview session"""
    __tablename__ = "session_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_source: Mapped[QuestionSource] = mapped_column(Enum(QuestionSource), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)  # 1=Q1, 2=Q1-FU, 3=Q2, 4=Q2-FU, 5=Q3, 6=Q3-FU
    parent_question_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("session_questions.id"), nullable=True)
    audio_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)  # Pre-generated TTS audio for Aria
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="questions")
    response: Mapped[Optional["CandidateResponse"]] = relationship("CandidateResponse", back_populates="question", uselist=False)


class CandidateResponse(Base):
    """Candidate's spoken response to each question"""
    __tablename__ = "candidate_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("session_questions.id"), nullable=False)
    transcript_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Whisper STT output
    audio_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)  # Candidate audio in GCS
    video_timestamp_start: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Seconds from session start
    video_timestamp_end: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    response_duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    word_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="responses")
    question: Mapped["SessionQuestion"] = relationship("SessionQuestion", back_populates="response")


class AnalysisResult(Base):
    """AI-generated behavioral and content analysis for the full session"""
    __tablename__ = "analysis_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), unique=True, nullable=False)

    # ── Behavioral Scores (0–100) ──────────────────────────────────────────
    eye_contact_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    body_language_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    facial_expression_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hand_gesture_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    posture_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # ── Content Scores (0–100) ─────────────────────────────────────────────
    psychometric_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    endurance_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cognitive_ability_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    gross_speed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    throughput: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    net_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cognitive_composite_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    t_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    forensic_analysis_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    adaptability_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    communication_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    team_management_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    leadership_quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    vision_and_mission_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    strategic_thinking_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # ── Composite Scores ──────────────────────────────────────────────────
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    mindset_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # "Growth", "Fixed", "Analytical"
    attitude_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # "Positive", "Neutral", "Negative"

    @property
    def ethical_decision_making_label(self) -> Optional[str]:
        return self.attitude_label

    @ethical_decision_making_label.setter
    def ethical_decision_making_label(self, val: Optional[str]):
        self.attitude_label = val
    domain_recommendation: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)  # "Frontend Dev", "QA", etc.
    secondary_domain: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # ── AI-Generated Text ─────────────────────────────────────────────────
    summary_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Aria's narrative summary
    strengths: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # List of strengths
    areas_of_improvement: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    red_flags: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # ── Raw Data ──────────────────────────────────────────────────────────
    behavioral_timeline_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Per-second MediaPipe data
    per_question_analysis_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    profile_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    longitudinal_trends: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # ── Advanced Intelligence (A–D categories) ────────────────────────────────
    # A: Behavioural — evasion_score, evasion_indicators, contradictions,
    #                   language_maturity, filler_word_count, vocabulary_richness,
    #                   tone_map, response_depth_scores
    advanced_behavioral_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # B: Longitudinal — commitment_score, commitment_evidence, personality_drift,
    #                    drift_evidence, career_alignment, alignment_explanation,
    #                    stagnation_alert, stagnation_note
    advanced_longitudinal_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # C: Psychological — ocean_profile, pressure_resilience, pressure_evidence,
    #                     self_awareness_score, self_awareness_note,
    #                     motivation_type, motivation_evidence
    advanced_psychological_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # D: Report intelligence — executive_summary, candidate_archetype,
    #                           archetype_description, radar_current, radar_previous,
    #                           retention_risk, retention_score, hr_action_plan
    advanced_report_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    analyzed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="analysis_result")


# Model name alias for router compatibility
InterviewAnalysis = AnalysisResult



class InterviewReport(Base):
    """Final HR report generated after analysis"""
    __tablename__ = "interview_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), unique=True, nullable=False)
    pdf_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)  # GCS signed URL
    full_transcript_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    viewed_by_hr_ids: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # List of HR user IDs who viewed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="report")


class ProctoringViolation(Base):
    """Anti-cheating violation events during interview"""
    __tablename__ = "proctoring_violations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    violation_type: Mapped[ViolationType] = mapped_column(Enum(ViolationType), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    session_timestamp_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # When in the interview
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    screenshot_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="violations")


class QuestionHistory(Base):
    """
    Tracks every question shown to each candidate across ALL sessions.
    Used for deduplication — a candidate will never receive the same question twice
    until their entire question pool for a given type/year is exhausted.
    """
    __tablename__ = "question_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    question_bank_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("question_bank.id"), nullable=True, index=True)
    question_text_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 first 64 chars for AI-generated dedup
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), nullable=False)
    bond_year: Mapped[int] = mapped_column(Integer, nullable=False)
    pool_exhausted_reset: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # True if pool was reset before this selection
    asked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate")
    session: Mapped["InterviewSession"] = relationship("InterviewSession")


class CognitiveQuestion(Base):
    __tablename__ = "cognitive_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain: Mapped[CognitiveDomain] = mapped_column(Enum(CognitiveDomain), nullable=False)
    subcategory: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    difficulty: Mapped[QuestionDifficulty] = mapped_column(Enum(QuestionDifficulty), nullable=False, default=QuestionDifficulty.MEDIUM)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSON, nullable=False)
    correct_answer_index: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    template_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[QuestionStatus] = mapped_column(Enum(QuestionStatus), default=QuestionStatus.ACTIVE, nullable=False)
    estimated_time: Mapped[int] = mapped_column(Integer, default=60, nullable=False) # seconds
    exposure_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SessionCognitiveQuestion(Base):
    __tablename__ = "session_cognitive_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    cognitive_question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cognitive_questions.id"), nullable=False, index=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_option_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="cognitive_questions")
    cognitive_question: Mapped["CognitiveQuestion"] = relationship("CognitiveQuestion")


class PsychometricQuestion(Base):
    __tablename__ = "psychometric_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trait: Mapped[str] = mapped_column(String(64), nullable=False)
    statement_text: Mapped[str] = mapped_column(Text, nullable=False)
    # ideal_response: The direction of scoring for this question.
    # "SA" = Strongly Agree is positive; "SD" = Strongly Disagree is positive;
    # "N" = Neutral anchored (score toward 3). Enables balanced assessment.
    ideal_response: Mapped[Optional[str]] = mapped_column(String(4), nullable=True, default="SA")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SessionPsychometricQuestion(Base):
    __tablename__ = "session_psychometric_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=False, index=True)
    psychometric_question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("psychometric_questions.id"), nullable=False, index=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="psychometric_questions")
    psychometric_question: Mapped["PsychometricQuestion"] = relationship("PsychometricQuestion")


# ── RAG Production System Models (Layer 5: Database Layer) ────────────────────

class RAGDocument(Base):
    __tablename__ = "rag_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    total_chunks: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    chunks: Mapped[list["RAGChunk"]] = relationship("RAGChunk", back_populates="document", cascade="all, delete-orphan")


class RAGChunk(Base):
    __tablename__ = "rag_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rag_documents.id"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    section_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding_json: Mapped[Optional[list]] = mapped_column(JSON, nullable=True) # Normalized vector representation
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    document: Mapped["RAGDocument"] = relationship("RAGDocument", back_populates="chunks")


class RAGQueryLog(Base):
    __tablename__ = "rag_query_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_email: Mapped[str] = mapped_column(String(255), default="hr_manager@hcltech.com")
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    retrieved_chunks_count: Mapped[int] = mapped_column(Integer, default=0)
    retrieved_chunk_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    response_text: Mapped[str] = mapped_column(Text, nullable=False)
    tokens_saved_estimate: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)



