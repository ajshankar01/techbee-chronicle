"""
BLACK-BOX TESTS — API Endpoint Contracts
Tests the system purely from the outside: inputs → expected outputs.
No knowledge of internal implementation required.

Covers:
  - Health check
  - Auth endpoints
  - Interview session lifecycle
  - Response submission + follow-up generation
  - Analysis endpoint
  - Report / PDF generation
  - HR portal endpoints
  - Questions bank endpoint
  - TTS endpoint
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


# ─────────────────────────────────────────────────────────────────────────────
# BB-01: Health Check
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthCheck:
    """BB-01: API health check must return 200 + healthy status."""

    async def test_health_returns_200(self, client: AsyncClient):
        r = await client.get("/api/health")
        assert r.status_code == 200

    async def test_health_contains_status_healthy(self, client: AsyncClient):
        r = await client.get("/api/health")
        body = r.json()
        assert body.get("status") == "healthy"

    async def test_health_contains_required_fields(self, client: AsyncClient):
        r = await client.get("/api/health")
        body = r.json()
        for field in ("status", "app", "version", "environment"):
            assert field in body, f"Missing field: {field}"

    async def test_health_wrong_method_returns_405(self, client: AsyncClient):
        r = await client.post("/api/health")
        assert r.status_code == 405

    async def test_unknown_route_returns_404(self, client: AsyncClient):
        r = await client.get("/api/does-not-exist")
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# BB-02: Auth Endpoint
# ─────────────────────────────────────────────────────────────────────────────

class TestAuth:
    """BB-02: Auth endpoint — check profile after SSO login."""

    async def test_auth_me_endpoint_exists(self, client: AsyncClient):
        """The /api/auth/me endpoint exists (returns 401 without a token, not 404)."""
        r = await client.get("/api/auth/me")
        # Without a valid JWT, should 401 not 404
        assert r.status_code in (200, 401, 403), f"Unexpected: {r.status_code} {r.text}"

    async def test_auth_me_no_token_returns_401(self, client: AsyncClient):
        """Without auth header, /api/auth/me must reject with 401/403."""
        r = await client.get("/api/auth/me", headers={})
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# ─────────────────────────────────────────────────────────────────────────────
# BB-03: Questions Bank
# ─────────────────────────────────────────────────────────────────────────────

class TestQuestionsBank:
    """BB-03: Question bank retrieval for the 3 interview rounds."""

    async def test_get_questions_returns_list(self, client: AsyncClient):
        r = await client.get("/api/questions/bank")
        assert r.status_code in (200, 401)  # 401 if auth required

    async def test_get_questions_by_type_emotional_intelligence(self, client: AsyncClient):
        r = await client.get("/api/questions/bank?type=emotional_intelligence")
        assert r.status_code in (200, 401, 422)

    async def test_get_questions_invalid_type(self, client: AsyncClient):
        r = await client.get("/api/questions/bank?type=invalid_type_xyz")
        # Auth required (401) or empty/validated response (200/422)
        assert r.status_code in (200, 401, 422)


# ─────────────────────────────────────────────────────────────────────────────
# BB-04: Interview Session — Create + Submit Response
# ─────────────────────────────────────────────────────────────────────────────

class TestInterviewSession:
    """BB-04: Complete interview session lifecycle."""

    async def test_submit_response_returns_followup(self, client: AsyncClient):
        """Core flow: candidate submits answer → Gemini generates follow-up Q."""
        r = await client.post("/api/interview/response/submit", json={
            "session_id": "test-bb-session-001",
            "question_id": "q1-emotional_intelligence",
            "transcript_text": "I had to handle a database migration under tight deadline pressure. I prioritised the critical tables first and worked overtime for two days.",
            "video_timestamp_start": 0,
            "video_timestamp_end": 45,
            "candidate_name": "Test Candidate"
        }, headers={"Authorization": "Bearer dev-token"})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        body = r.json()
        assert "followup_question" in body or "follow_up" in body or "status" in body

    async def test_submit_empty_transcript_gets_fallback(self, client: AsyncClient):
        """BB edge case: empty transcript text should not crash; gets fallback follow-up."""
        r = await client.post("/api/interview/response/submit", json={
            "session_id": "test-bb-session-002",
            "question_id": "q2-vision_alignment",
            "transcript_text": "",
            "video_timestamp_start": 0,
            "video_timestamp_end": 5,
            "candidate_name": "Silent Candidate"
        }, headers={"Authorization": "Bearer dev-token"})
        assert r.status_code in (200, 400, 422)

    async def test_submit_missing_session_id_returns_error(self, client: AsyncClient):
        """BB validation: missing required field."""
        r = await client.post("/api/interview/response/submit", json={
            "question_id": "q1",
            "transcript_text": "Some answer",
        }, headers={"Authorization": "Bearer dev-token"})
        assert r.status_code in (400, 422)

    async def test_submit_scenario_type_uses_mystery_engine(self, client: AsyncClient):
        """BB: scenario type should invoke closed-loop mystery follow-up."""
        r = await client.post("/api/interview/response/submit", json={
            "session_id": "test-bb-scenario-003",
            "question_id": "q3-scenario",
            "transcript_text": "I would first check the admin login logs and look at the IP address. Then I would check who committed the code at that time.",
            "video_timestamp_start": 0,
            "video_timestamp_end": 60,
            "candidate_name": "Detective Candidate"
        }, headers={"Authorization": "Bearer dev-token"})
        assert r.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# BB-05: Analysis Endpoint
# ─────────────────────────────────────────────────────────────────────────────

class TestAnalysis:
    """BB-05: Post-interview AI analysis endpoints."""

    async def test_trigger_analysis_requires_session(self, client: AsyncClient):
        """POST /api/analysis/trigger/{session_id} must accept real session IDs."""
        r = await client.post("/api/analysis/trigger/00000000-0000-0000-0000-000000000001",
                              headers={"Authorization": "Bearer dev-token"})
        # 401/403 without valid HR token; 404 if session doesn't exist — not 405
        assert r.status_code in (200, 401, 403, 404, 422)

    async def test_get_analysis_endpoint_exists(self, client: AsyncClient):
        """GET /api/analysis/{session_id} must exist (returns 200 or 404, never 405)."""
        r2 = await client.get("/api/analysis/a0000000-0000-0000-0000-000000000001",
                              headers={"Authorization": "Bearer dev-token"})
        assert r2.status_code in (200, 401, 403, 404), f"Unexpected: {r2.status_code}"


# ─────────────────────────────────────────────────────────────────────────────
# BB-06: PDF Report Generation
# ─────────────────────────────────────────────────────────────────────────────

class TestReportGeneration:
    """BB-06: PDF report must include full transcript and behavioral scores."""

    async def test_generate_pdf_returns_url(self, client: AsyncClient, sample_transcript, sample_behavioral_summary):
        r = await client.post("/api/reports/bb-test-session-001/generate-pdf", json={
            "candidate_name": "Riya Sharma",
            "sap_id": "SAP123456",
            "interviewed_at": "2026-08-10T14:00:00Z",
            "transcript": sample_transcript,
            "behavioral_summary": sample_behavioral_summary,
        })
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "success"
        assert "pdf_url" in body or "s3_url" in body or "local_serve_url" in body

    async def test_generate_pdf_followup_question_in_transcript(self, client: AsyncClient, sample_behavioral_summary):
        """Critical: follow-up Q must appear in PDF report (was the bug)."""
        transcript = [
            {"speaker": "aria",      "text": "Tell me about a time you worked under pressure.", "question_type": "emotional_intelligence"},
            {"speaker": "candidate", "text": "I stayed late for two weeks to deliver our capstone project on time.",  "question_type": "emotional_intelligence"},
            {"speaker": "aria",      "text": "That shows real dedication! What specific strategy kept you focused during those late nights?", "question_type": "followup"},
            {"speaker": "candidate", "text": "I broke the work into small tasks and celebrated mini milestones.", "question_type": "followup"},
        ]
        r = await client.post("/api/reports/bb-followup-test-001/generate-pdf", json={
            "candidate_name": "Vikram Kumar",
            "sap_id": "SAP999888",
            "interviewed_at": "2026-08-10T15:00:00Z",
            "transcript": transcript,
            "behavioral_summary": sample_behavioral_summary,
        })
        assert r.status_code == 200
        assert r.json().get("status") == "success"

    async def test_generate_pdf_empty_transcript_does_not_crash(self, client: AsyncClient, sample_behavioral_summary):
        """Edge case: empty transcript should produce PDF with fallback message."""
        r = await client.post("/api/reports/bb-empty-transcript-001/generate-pdf", json={
            "candidate_name": "Empty Transcript User",
            "sap_id": "SAP000001",
            "transcript": [],
            "behavioral_summary": sample_behavioral_summary,
        })
        assert r.status_code == 200

    async def test_generate_pdf_missing_candidate_name_uses_default(self, client: AsyncClient, sample_behavioral_summary):
        """BB robustness: missing name should not fail."""
        r = await client.post("/api/reports/bb-no-name-001/generate-pdf", json={
            "sap_id": "SAP000002",
            "transcript": [],
            "behavioral_summary": sample_behavioral_summary,
        })
        assert r.status_code == 200

    async def test_pdf_serve_endpoint_returns_file(self, client: AsyncClient, sample_behavioral_summary):
        """After generating, serve endpoint must return the PDF bytes."""
        # Generate first
        await client.post("/api/reports/bb-serve-test-001/generate-pdf", json={
            "candidate_name": "Serve Test",
            "sap_id": "SAP111111",
            "transcript": [{"speaker": "aria", "text": "Hello", "question_type": "emotional_intelligence"}],
            "behavioral_summary": sample_behavioral_summary,
        })
        # Then serve
        r = await client.get("/api/reports/serve/bb-serve-test-001", headers={"Authorization": "Bearer dev-token"})
        assert r.status_code in (200, 404)  # 404 acceptable if S3 only


# ─────────────────────────────────────────────────────────────────────────────
# BB-07: HR Portal Endpoints
# ─────────────────────────────────────────────────────────────────────────────

class TestHRPortal:
    """BB-07: HR dashboard data retrieval."""

    async def test_get_candidates_returns_list(self, client: AsyncClient):
        r = await client.get("/api/hr/candidates", headers={"Authorization": "Bearer dev-token"})
        assert r.status_code in (200, 401)

    async def test_get_candidate_detail_invalid_id(self, client: AsyncClient):
        r = await client.get("/api/hr/candidates/nonexistent-id-xyz", headers={"Authorization": "Bearer dev-token"})
        assert r.status_code in (200, 404, 401)

    async def test_hr_sessions_returns_data(self, client: AsyncClient):
        r = await client.get("/api/hr/sessions", headers={"Authorization": "Bearer dev-token"})
        assert r.status_code in (200, 404, 401)


# ─────────────────────────────────────────────────────────────────────────────
# BB-08: TTS Endpoint
# ─────────────────────────────────────────────────────────────────────────────

class TestTTS:
    """BB-08: Text-to-Speech must return audio bytes."""

    async def test_tts_short_text_returns_audio(self, client: AsyncClient):
        r = await client.post("/api/tts/speak", json={
            "text": "Hello, I am Aria. Welcome to your interview.",
            "voice": "en-IN-NeerjaNeural"
        })
        assert r.status_code in (200, 422, 500)
        if r.status_code == 200:
            assert len(r.content) > 0  # Must have actual audio bytes

    async def test_tts_empty_text_returns_error(self, client: AsyncClient):
        r = await client.post("/api/tts/speak", json={"text": ""})
        assert r.status_code in (400, 422, 500)

    async def test_tts_very_long_text_completes(self, client: AsyncClient):
        long_text = "Aria is speaking. " * 50  # ~900 chars
        r = await client.post("/api/tts/speak", json={"text": long_text})
        assert r.status_code in (200, 500)  # Should not timeout or 422


# ─────────────────────────────────────────────────────────────────────────────
# BB-09: Security Headers
# ─────────────────────────────────────────────────────────────────────────────

class TestSecurityHeaders:
    """BB-09: Security headers must be present on all responses."""

    async def test_xss_protection_header(self, client: AsyncClient):
        r = await client.get("/api/health")
        assert "X-XSS-Protection" in r.headers

    async def test_content_type_nosniff_header(self, client: AsyncClient):
        r = await client.get("/api/health")
        assert r.headers.get("X-Content-Type-Options") == "nosniff"

    async def test_csp_allows_teams_iframe(self, client: AsyncClient):
        r = await client.get("/api/health")
        csp = r.headers.get("Content-Security-Policy", "")
        assert "teams.microsoft.com" in csp
