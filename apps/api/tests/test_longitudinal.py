import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.gemini_service import generate_yearly_baseline_question, analyze_interview_session

pytestmark = pytest.mark.asyncio


class TestLongitudinalQuestionGeneration:
    """Tests the yearly progressive question generation logic."""

    async def test_year1_returns_baseline(self):
        """Year 1 should always return the standard baseline question directly."""
        result = await generate_yearly_baseline_question(bond_year=1, candidate_name="Priya Sharma")
        assert "Welcome to Techbee Chronicle, Priya." in result
        assert "tell me about yourself" in result.lower()

    async def test_year2_without_snapshot_returns_baseline(self):
        """Year 2 without previous snapshot should fall back to baseline."""
        result = await generate_yearly_baseline_question(bond_year=2, candidate_name="Priya Sharma", previous_snapshot=None)
        assert "Welcome to Techbee Chronicle, Priya." in result
        assert "tell me about yourself" in result.lower()

    async def test_year2_with_snapshot_calls_gemini(self):
        """Year 2 with snapshot should call Gemini to construct a personalized question."""
        snapshot = {
            "vision": "Become cloud architect",
            "goals": ["Master React", "Learn Docker"],
            "weaknesses": ["Public speaking"],
            "domain": "Full-Stack Web Development"
        }
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = "Priya, last year you mentioned wanting to master React. What is the progress?"
            result = await generate_yearly_baseline_question(
                bond_year=2,
                candidate_name="Priya Sharma",
                previous_snapshot=snapshot
            )
            assert result == "Priya, last year you mentioned wanting to master React. What is the progress?"
            mock_gen.assert_called_once()
            # Verify the prompt contained details from the snapshot
            called_prompt = mock_gen.call_args[0][0]
            assert "Become cloud architect" in called_prompt
            assert "Master React" in called_prompt
            assert "Public speaking" in called_prompt


class TestLongitudinalAnalysis:
    """Tests Year-over-Year (YoY) progression and trend comparison analysis."""

    async def test_analysis_compares_trends_and_outputs_snapshot(self):
        """Analysis with a previous snapshot should yield YoY trend scores and a new snapshot."""
        snapshot = {
            "vision": "Become cloud architect",
            "goals": ["Learn Docker"],
            "weaknesses": ["Public speaking"],
            "domain": "Full-Stack Web Development"
        }
        mock_response = {
            "overall_score": 88,
            "scores": {
                "vision_alignment": 85, "emotional_intelligence": 90, "stress_tolerance": 87,
                "adaptability": 85, "team_collaboration": 88, "ethical_decision_making": 92,
                "eye_contact": 80, "body_language": 84
            },
            "mindset_label": "High Maturity Growth",
            "ethical_decision_making_label": "Excellent",
            "summary_text": "Priya showed exceptional maturity.",
            "domain_recommendation": "Cloud Infrastructure",
            "secondary_domain": "Full-Stack Web Development",
            "strengths": ["Docker expertise"],
            "areas_of_improvement": ["Public speaking adaptability"],
            "red_flags": [],
            "is_flagged": False,
            "profile_snapshot": {
                "vision": "Grow into technical architect",
                "goals": ["Kubernetes mastery"],
                "weaknesses": ["Stakeholder meetings"],
                "domain": "Cloud Infrastructure"
            },
            "longitudinal_trends": {
                "maturity_change": 12.5,
                "capability_change": 10.0,
                "retention_stability": 5.0,
                "growth_trajectory": "Exceptional"
            }
        }

        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = json.dumps(mock_response)
            
            result = await analyze_interview_session(
                candidate_name="Priya Sharma",
                full_transcript=[
                    {"speaker": "aria", "text": "What is the progress on your cloud goal?"},
                    {"speaker": "candidate", "text": "I set up Docker for three internal teams and successfully scaled our microservices infrastructure."}
                ],
                previous_snapshot=snapshot,
                bond_year=2
            )

            assert result["overall_score"] == 88
            assert result["profile_snapshot"]["vision"] == "Grow into technical architect"
            assert result["longitudinal_trends"]["maturity_change"] == 12.5
            mock_gen.assert_called_once()
            
            # Check prompt
            called_prompt = mock_gen.call_args[0][0]
            assert "Become cloud architect" in called_prompt
            assert "Year 2" in called_prompt

    async def test_fallback_generates_snapshot_and_trends(self):
        """If Gemini fails, fallback returns valid snapshot structures."""
        with patch("app.services.gemini_service._gemini_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = None  # Force fallback
            
            result = await analyze_interview_session(
                candidate_name="Priya Sharma",
                full_transcript=[
                    {"speaker": "aria", "text": "Tell me about cloud"},
                    {"speaker": "candidate", "text": "I love cloud aws and I have been building containerized microservices and deploying them using Jenkins CI/CD pipelines."}
                ],
                previous_snapshot={"vision": "cloud vision", "goals": [], "weaknesses": [], "domain": "Cloud"},
                bond_year=2
            )
            
            assert "profile_snapshot" in result
            assert "longitudinal_trends" in result
            assert result["domain_recommendation"] == "Cloud & DevOps Engineering"
            assert result["longitudinal_trends"]["growth_trajectory"] == "Stable"

    async def test_candidate_silence_returns_failure(self):
        """If the candidate transcript is empty or silent, the evaluation automatically fails."""
        result = await analyze_interview_session(
            candidate_name="Silent Candidate",
            full_transcript=[
                {"speaker": "aria", "text": "Tell me about cloud"},
                {"speaker": "candidate", "text": "   "},  # silent response
                {"speaker": "aria", "text": "How about soft skills?"},
                {"speaker": "candidate", "text": "ok"}  # too short
            ],
            previous_snapshot={"vision": "cloud vision", "goals": [], "weaknesses": [], "domain": "Cloud"},
            bond_year=2
        )
        
        assert result["overall_score"] == 10
        assert result["scores"]["vision_alignment"] == 0
        assert result["scores"]["emotional_intelligence"] == 0
        assert result["is_flagged"] is True
        assert "remained silent" in result["red_flags"][0]
        assert "Evaluation Failed" in result["summary_text"]

