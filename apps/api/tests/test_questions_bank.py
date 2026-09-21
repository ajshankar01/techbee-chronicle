import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import SessionQuestion

pytestmark = pytest.mark.asyncio

class TestQuestionBankAndSessionUpgrades:
    """Tests the new Question Bank, Candidate Search, and Dynamic Session Creation requirements."""

    async def test_get_question_bank(self, client: AsyncClient):
        # 1. Fetch all questions from bank
        res = await client.get("/api/questions/bank", headers={"Authorization": "Bearer dev-token"})
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 100  # The seeder should have populated 100 questions
        
        # Verify structure
        q = data[0]
        assert "id" in q
        assert "type" in q
        assert "text" in q
        
        # Test filtering by category
        res_filtered = await client.get("/api/questions/bank?question_type=cultural_fit", headers={"Authorization": "Bearer dev-token"})
        assert res_filtered.status_code == 200
        filtered_data = res_filtered.json()
        assert all(item["type"] == "cultural_fit" for item in filtered_data)

    async def test_add_and_delete_question(self, client: AsyncClient):
        # 1. Add a question
        add_res = await client.post("/api/questions/bank", json={
            "question_type": "endurance",
            "question_text": "This is a custom endurance question for testing.",
            "tags": {"custom": True}
        }, headers={"Authorization": "Bearer dev-token"})
        assert add_res.status_code == 200
        add_data = add_res.json()
        q_id = add_data["id"]
        assert q_id is not None

        # Verify it's in the bank
        res = await client.get("/api/questions/bank?question_type=endurance", headers={"Authorization": "Bearer dev-token"})
        assert res.status_code == 200
        questions = res.json()
        assert any(q["id"] == q_id for q in questions)

        # 2. Delete the question
        del_res = await client.delete(f"/api/questions/bank/{q_id}", headers={"Authorization": "Bearer dev-token"})
        assert del_res.status_code == 200
        assert del_res.json()["message"] == "Question deleted successfully"

        # Verify it's no longer in the bank
        res2 = await client.get("/api/questions/bank?question_type=endurance", headers={"Authorization": "Bearer dev-token"})
        assert res2.status_code == 200
        questions2 = res2.json()
        assert not any(q["id"] == q_id for q in questions2)

    async def test_candidate_search(self, client: AsyncClient):
        # Search for seeded candidate "Priya"
        res = await client.get("/api/hr/candidates/search?q=Priya", headers={"Authorization": "Bearer dev-token"})
        assert res.status_code == 200
        data = res.json()
        assert len(data) > 0
        candidate = data[0]
        assert "Priya Sharma" in candidate["full_name"]
        assert candidate["email"] in ("priya.sharma@techbee.in", "priya.sharma@techbee.com")

    async def test_create_session_with_random_questions(self, client: AsyncClient):
        # 1. Search for Priya to get her real ID
        search_res = await client.get("/api/hr/candidates/search?q=Priya", headers={"Authorization": "Bearer dev-token"})
        assert search_res.status_code == 200
        candidate = search_res.json()[0]
        candidate_id = candidate["id"]

        # 2. Create session with 5 questions
        create_res = await client.post("/api/interview/sessions", json={
            "candidate_id": candidate_id,
            "num_questions": 5,
            "notes": "Testing dynamic round-robin questioning"
        }, headers={"Authorization": "Bearer dev-token"})
        assert create_res.status_code == 200
        create_data = create_res.json()
        assert "session_id" in create_data
        session_uuid = uuid.UUID(create_data["session_id"])

        # 3. Query the database to verify session questions setup
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SessionQuestion)
                .where(SessionQuestion.session_id == session_uuid)
                .order_by(SessionQuestion.order_index)
            )
            session_questions = result.scalars().all()
            
            # Verify we have exactly 5 questions
            assert len(session_questions) == 5
            
            # Verify the order index offsets (1, 3, 5, 7, 9)
            indices = [q.order_index for q in session_questions]
            assert indices == [1, 3, 5, 7, 9]
            
            # Verify categories are unique (since we have 5 categories and we request 5, they should be one of each)
            categories = [q.question_type.value for q in session_questions]
            assert len(set(categories)) == 5
            assert set(categories) == {"emotional_intelligence", "vision_alignment", "endurance", "cognitive", "cultural_fit"}

    async def test_create_candidate(self, client: AsyncClient):
        # 1. Create a candidate
        random_email = f"bala_{uuid.uuid4()}@hcl.com"
        res = await client.post("/api/hr/candidates", json={
            "display_name": "Bala Subramanian",
            "email": random_email,
            "batch_year": 2026
        }, headers={"Authorization": "Bearer dev-token"})
        assert res.status_code == 200
        data = res.json()
        assert data["full_name"] == "Bala Subramanian"
        assert data["email"] == random_email
        assert "id" in data
        assert "employee_id" in data

        # 2. Verify we can search for the candidate
        search_res = await client.get("/api/hr/candidates/search?q=bala", headers={"Authorization": "Bearer dev-token"})
        assert search_res.status_code == 200
        search_data = search_res.json()
        assert any(item["email"] == random_email for item in search_data)
