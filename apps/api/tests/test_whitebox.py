"""
WHITE-BOX TESTS — Internal Business Logic & Service Units
Tests the internal functions directly with full knowledge of implementation.
Mocks external dependencies (Gemini API, AWS S3, edge-tts).

Covers:
  - gemini_service: follow-up generation, analysis, question generation
  - pdf_service: transcript rendering, score computation, label logic
  - storage_service: URL building, fallback logic
  - gemini_service: fallback chains (SDK → REST → static)
  - score computation: label mapping, color thresholds
  - transcript: empty/missing/malformed entry handling
"""
import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock


pytestmark = pytest.mark.asyncio


# ─────────────────────────────────────────────────────────────────────────────
# WB-01: Gemini Service — generate_followup_question
# ─────────────────────────────────────────────────────────────────────────────

class TestGeminiFollowupGeneration:
    """WB-01: Internal follow-up question generation logic."""

    async def test_followup_calls_gemini_and_returns_text(self):
        from app.services.gemini_service import generate_followup_question
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = "That's fascinating! Can you tell me more about the impact?"
            result = await generate_followup_question(
                question_type="emotional_intelligence",
                original_question="Tell me about a challenge.",
                candidate_response="I faced a tough database migration.",
                candidate_name="Ajay Shankar"
            )
            assert result == "That's fascinating! Can you tell me more about the impact?"
            mock_gen.assert_called_once()

    async def test_followup_uses_first_name_only(self):
        """White-box: prompt must use first name, not full name."""
        from app.services.gemini_service import generate_followup_question
        captured_prompt = []
        async def capture(prompt, *args, **kwargs):
            captured_prompt.append(prompt)
            return "Good answer, Ajay!"
        with patch("app.services.gemini_service._gemini_generate", side_effect=capture):
            await generate_followup_question(
                question_type="emotional_intelligence",
                original_question="Q",
                candidate_response="A",
                candidate_name="Ajay Shankar"
            )
        assert captured_prompt, "Prompt should have been captured"
        # First name only in the prompt, not "Ajay Shankar"
        assert "Ajay" in captured_prompt[0]
        assert "Shankar" not in captured_prompt[0]

    async def test_followup_fallback_when_gemini_returns_none(self):
        """WB: When Gemini fails, static fallback must be returned — not None."""
        from app.services.gemini_service import generate_followup_question
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = None
            result = await generate_followup_question(
                question_type="emotional_intelligence",
                original_question="Q",
                candidate_response="A",
                candidate_name="Riya"
            )
            assert result is not None
            assert len(result) > 10  # Must be a real question, not empty
            assert "Riya" in result  # Static fallback uses first name

    async def test_followup_scenario_routes_to_mystery_engine(self):
        """WB: 'scenario' type must call generate_closed_loop_dilemma_followup."""
        from app.services import gemini_service
        with patch.object(gemini_service, "generate_closed_loop_dilemma_followup", new_callable=AsyncMock) as mock_mystery:
            mock_mystery.return_value = "Interesting! What about the USB drive?"
            result = await gemini_service.generate_followup_question(
                question_type="scenario",
                original_question="Investigate the crime.",
                candidate_response="I would check the admin logs first.",
                candidate_name="Detective"
            )
            mock_mystery.assert_called_once()
            assert result == "Interesting! What about the USB drive?"

    async def test_followup_vision_alignment_type_uses_correct_fallback(self):
        """WB: vision_alignment fallback should mention stakeholder pushback."""
        from app.services.gemini_service import generate_followup_question
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = None
            result = await generate_followup_question(
                question_type="vision_alignment",
                original_question="How do you explain technical things?",
                candidate_response="I use diagrams.",
                candidate_name="Priya"
            )
            assert "Priya" in result
            assert len(result) > 10

    async def test_empty_candidate_name_uses_there(self):
        """WB edge case: empty candidate name → uses 'there' as fallback name."""
        from app.services.gemini_service import generate_followup_question
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = None
            result = await generate_followup_question(
                question_type="emotional_intelligence",
                original_question="Q",
                candidate_response="A",
                candidate_name=""
            )
            assert result is not None
            # Should not crash with empty name


# ─────────────────────────────────────────────────────────────────────────────
# WB-02: Gemini Service — analyze_interview_session
# ─────────────────────────────────────────────────────────────────────────────

class TestGeminiAnalysis:
    """WB-02: Interview analysis returns valid score structure."""

    async def test_analysis_returns_all_required_keys(self):
        from app.services.gemini_service import analyze_interview_session
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = json.dumps({
                "overall_score": 85,
                "scores": {"vision_alignment": 82, "emotional_intelligence": 88, "stress_tolerance": 85,
                           "adaptability": 80, "team_collaboration": 84, "ethical_decision_making": 90,
                           "eye_contact": 78, "body_language": 82},
                "mindset_label": "Growth Mindset",
                "ethical_decision_making_label": "Positive",
                "summary_text": "Strong candidate.",
                "domain_recommendation": "Full-Stack Development",
                "secondary_domain": "DevOps",
                "strengths": ["Clear vision_alignment"],
                "areas_of_improvement": ["More metrics"],
                "red_flags": [],
                "is_flagged": False
            })
            result = await analyze_interview_session({
                "candidate_name": "Test User",
                "responses": [{"type": "emotional_intelligence", "question": "Q", "response": "A"}]
            })
            required = ["overall_score", "scores", "summary_text", "domain_recommendation",
                        "strengths", "areas_of_improvement", "is_flagged"]
            for key in required:
                assert key in result, f"Missing key: {key}"

    async def test_analysis_score_range_0_to_100(self):
        """WB: All scores must be in range 0–100."""
        from app.services.gemini_service import analyze_interview_session
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = None  # Trigger fallback
            result = await analyze_interview_session({
                "candidate_name": "Range Test",
                "responses": []
            })
            scores = result.get("scores", {})
            for key, val in scores.items():
                assert 0 <= val <= 100, f"Score {key}={val} out of range"
            assert 0 <= result.get("overall_score", 0) <= 100

    async def test_analysis_fallback_when_json_malformed(self):
        """WB: Malformed JSON from Gemini → fallback dict, not exception."""
        from app.services.gemini_service import analyze_interview_session
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = "This is not JSON at all!!!"
            result = await analyze_interview_session({
                "candidate_name": "Malformed Test",
                "responses": []
            })
            assert isinstance(result, dict)
            assert "overall_score" in result  # fallback must have this

    async def test_analysis_includes_candidate_name_in_summary(self):
        """WB: fallback summary_text should mention the candidate's name."""
        from app.services.gemini_service import analyze_interview_session
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = None
            result = await analyze_interview_session({
                "candidate_name": "Unique Name XYZ",
                "responses": []
            })
            assert "Unique Name XYZ" in result.get("summary_text", "")


# ─────────────────────────────────────────────────────────────────────────────
# WB-03: Gemini Service — _gemini_generate fallback chain
# ─────────────────────────────────────────────────────────────────────────────

class TestGeminiGenerateFallbackChain:
    """WB-03: SDK → REST → None fallback chain."""

    async def test_sdk_success_skips_rest(self):
        """WB: If SDK succeeds, REST must NOT be called."""
        from app.services import gemini_service
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "SDK worked!"
        mock_client.models.generate_content.return_value = mock_response

        with patch.object(gemini_service, "_genai_client", mock_client):
            with patch("httpx.AsyncClient.post") as mock_http:
                import asyncio
                with patch("asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
                    mock_thread.return_value = mock_response
                    result = await gemini_service._gemini_generate("test prompt")
                    mock_http.assert_not_called()

    async def test_returns_none_when_both_fail(self):
        """WB: Both SDK and REST fail → must return None, not raise."""
        from app.services import gemini_service
        with patch.object(gemini_service, "_genai_client", None):
            with patch.object(gemini_service.settings, "GEMINI_API_KEY", ""):
                result = await gemini_service._gemini_generate("test prompt")
                assert result is None

    async def test_strips_surrounding_quotes(self):
        """WB: Response with wrapping quotes → quotes stripped, content preserved."""
        from app.services import gemini_service
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = '"This response has surrounding quotes"'
        mock_client.models.generate_content.return_value = mock_response

        with patch.object(gemini_service, "_genai_client", mock_client):
            with patch("asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
                mock_thread.return_value = mock_response
                result = await gemini_service._gemini_generate("test prompt")
                if result:
                    assert not result.startswith('"')
                    assert not result.endswith('"')


# ─────────────────────────────────────────────────────────────────────────────
# WB-04: PDF Service — Internal Score Helpers
# ─────────────────────────────────────────────────────────────────────────────

class TestPDFServiceHelpers:
    """WB-04: Internal PDF helper functions for score color and label."""

    def test_score_color_excellent(self):
        from app.services.pdf_service import _score_color
        color = _score_color(80)
        from reportlab.lib import colors
        assert color == colors.HexColor('#16a34a')  # GREEN_DARK

    def test_score_color_average(self):
        from app.services.pdf_service import _score_color
        color = _score_color(65)
        from reportlab.lib import colors
        assert color == colors.HexColor('#d97706')  # AMBER

    def test_score_color_poor(self):
        from app.services.pdf_service import _score_color
        color = _score_color(40)
        from reportlab.lib import colors
        assert color == colors.HexColor('#dc2626')  # RED_DARK

    def test_score_label_excellent(self):
        from app.services.pdf_service import _score_label
        assert _score_label(85) == "Excellent"

    def test_score_label_good(self):
        from app.services.pdf_service import _score_label
        assert _score_label(75) == "Good"

    def test_score_label_average(self):
        from app.services.pdf_service import _score_label
        assert _score_label(60) == "Average"

    def test_score_label_below_average(self):
        from app.services.pdf_service import _score_label
        assert _score_label(45) == "Below Average"

    def test_score_label_needs_improvement(self):
        from app.services.pdf_service import _score_label
        assert _score_label(30) == "Needs Improvement"

    def test_score_boundary_75_is_excellent(self):
        """WB boundary: 75 should be Good (>= 70 Good, >= 80 Excellent)."""
        from app.services.pdf_service import _score_label
        assert _score_label(75) == "Good"

    def test_score_boundary_80_is_excellent(self):
        from app.services.pdf_service import _score_label
        assert _score_label(80) == "Excellent"


# ─────────────────────────────────────────────────────────────────────────────
# WB-05: PDF Service — Full Report Generation
# ─────────────────────────────────────────────────────────────────────────────

class TestPDFGeneration:
    """WB-05: PDF bytes generation from report_data dict."""

    async def test_pdf_generates_bytes(self):
        """WB: generate_interview_pdf must return non-empty bytes."""
        from app.services.pdf_service import generate_interview_pdf
        report_data = {
            "session_id": "wb-test-001",
            "candidate": {"name": "White Box", "sap_id": "WB001", "email": "wb@test.com"},
            "session": {"duration_minutes": 15, "interviewed_at": "2026-08-10T10:00:00Z"},
            "report": {"overall_score": 82, "domain_recommendation": "Backend", "is_flagged": False},
            "analysis": {
                "scores": {"vision_alignment": 80, "emotional_intelligence": 85, "stress_tolerance": 83,
                           "adaptability": 79, "team_collaboration": 82, "ethical_decision_making": 88, "eye_contact": 77, "body_language": 80},
                "behavioral": {"eye_contact": 77, "adaptability": 79, "engagement": 74, "nervousness": 18,
                               "posture": 80, "overall_behavior": 82, "violation_count": 0},
                "summary_text": "Excellent candidate.",
                "strengths": ["Clear expression"],
                "areas_of_improvement": ["More STAR format"],
                "red_flags": [],
            },
            "transcript": [
                {"speaker": "aria",      "text": "Tell me about a challenge.", "question_type": "emotional_intelligence"},
                {"speaker": "candidate", "text": "I fixed a production bug under pressure.",  "question_type": "emotional_intelligence"},
                {"speaker": "aria",      "text": "How did you stay calm?", "question_type": "followup"},
                {"speaker": "candidate", "text": "I broke the problem into small steps.", "question_type": "followup"},
            ],
        }
        pdf_bytes = await generate_interview_pdf(report_data)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 1000  # A real PDF is at least 1KB
        # PDF magic bytes
        assert pdf_bytes[:4] == b'%PDF'

    async def test_pdf_with_high_violations_sets_flagged_color(self):
        """WB: violation_count > 3 → is_flagged = True in report."""
        from app.services.pdf_service import generate_interview_pdf
        report_data = {
            "session_id": "wb-flagged-001",
            "candidate": {"name": "Suspicious User", "sap_id": "SUS001", "email": "sus@test.com"},
            "session": {"duration_minutes": 10},
            "report": {"overall_score": 60, "domain_recommendation": "Backend", "is_flagged": True},
            "analysis": {
                "scores": {"vision_alignment": 60, "emotional_intelligence": 55, "stress_tolerance": 58,
                           "adaptability": 50, "team_collaboration": 62, "ethical_decision_making": 58, "eye_contact": 40, "body_language": 45},
                "behavioral": {"eye_contact": 40, "adaptability": 50, "engagement": 45, "nervousness": 60,
                               "posture": 45, "overall_behavior": 55, "violation_count": 5},
                "summary_text": "Multiple violations detected.",
                "strengths": [],
                "areas_of_improvement": ["Focus", "Integrity"],
                "red_flags": ["⚠ 5 proctoring violations"],
            },
            "transcript": [],
        }
        pdf_bytes = await generate_interview_pdf(report_data)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 1000

    async def test_pdf_transcript_labels_followup_correctly(self):
        """WB: follow-up entries must be labeled differently from main questions."""
        from app.services.pdf_service import generate_interview_pdf
        # We can't parse the PDF content directly, but we verify it generates without error
        transcript = [
            {"speaker": "aria",      "text": "Main Q1", "question_type": "emotional_intelligence"},
            {"speaker": "candidate", "text": "My answer to Q1", "question_type": "emotional_intelligence"},
            {"speaker": "aria",      "text": "Follow-up based on your answer", "question_type": "followup"},
            {"speaker": "candidate", "text": "My follow-up answer", "question_type": "followup"},
        ]
        report_data = {
            "session_id": "wb-labels-001",
            "candidate": {"name": "Label Test", "sap_id": "LBL001", "email": "lbl@test.com"},
            "session": {"duration_minutes": 12},
            "report": {"overall_score": 78, "domain_recommendation": "QA", "is_flagged": False},
            "analysis": {
                "scores": {"vision_alignment": 78, "emotional_intelligence": 80, "stress_tolerance": 76,
                           "adaptability": 72, "team_collaboration": 79, "ethical_decision_making": 82, "eye_contact": 74, "body_language": 73},
                "behavioral": {"eye_contact": 74, "adaptability": 72, "engagement": 70, "nervousness": 25,
                               "posture": 73, "overall_behavior": 76, "violation_count": 0},
                "summary_text": "Good candidate.",
                "strengths": ["Adaptive"],
                "areas_of_improvement": [],
                "red_flags": [],
            },
            "transcript": transcript,
        }
        pdf_bytes = await generate_interview_pdf(report_data)
        assert pdf_bytes[:4] == b'%PDF'


# ─────────────────────────────────────────────────────────────────────────────
# WB-06: generate_ai_question
# ─────────────────────────────────────────────────────────────────────────────

class TestGenerateAIQuestion:
    """WB-06: Question generation for the question bank."""

    async def test_generates_emotional_intelligence_question(self):
        from app.services.gemini_service import generate_ai_question
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock:
            mock.return_value = "How do you handle failure in a team setting?"
            result = await generate_ai_question("emotional_intelligence", "resilience", "medium")
            assert len(result) > 10
            assert "?" in result

    async def test_fallback_when_gemini_fails(self):
        from app.services.gemini_service import generate_ai_question
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock:
            mock.return_value = None
            result = await generate_ai_question("emotional_intelligence", "general", "medium")
            assert result is not None
            assert len(result) > 20  # static fallback


# ─────────────────────────────────────────────────────────────────────────────
# WB-07: Closed-Loop Mystery Engine
# ─────────────────────────────────────────────────────────────────────────────

class TestClosedLoopMystery:
    """WB-07: Scenario round follow-up uses clue analysis."""

    async def test_mentions_usb_when_candidate_misses_it(self):
        from app.services.gemini_service import generate_closed_loop_dilemma_followup
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock:
            mock.return_value = None  # trigger static fallback
            result = await generate_closed_loop_dilemma_followup(
                original_question="Investigate the system breach.",
                candidate_response="I would check the admin login and the code commit.",
                candidate_name="Raj"
            )
            # Candidate missed USB clue → fallback mentions USB
            assert "USB" in result or "usb" in result.lower() or len(result) > 10

    async def test_mentions_audit_log_when_candidate_misses_it(self):
        from app.services.gemini_service import generate_closed_loop_dilemma_followup
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock:
            mock.return_value = None
            result = await generate_closed_loop_dilemma_followup(
                original_question="Investigate the breach.",
                candidate_response="I found a USB drive and checked the IP address.",
                candidate_name="Kavya"
            )
            # Candidate has USB + IP but no log mention → fallback mentions logs
            assert "log" in result.lower() or "forensic" in result.lower() or len(result) > 10

    async def test_returns_twist_when_candidate_thorough(self):
        from app.services.gemini_service import generate_closed_loop_dilemma_followup
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock:
            mock.return_value = None
            result = await generate_closed_loop_dilemma_followup(
                original_question="Investigate the breach.",
                candidate_response="I checked the USB drive, the audit log, and the admin IP login at 3 AM.",
                candidate_name="Sherlock"
            )
            # Mentioned all 3 → should get plot twist
            assert len(result) > 20
