"""
Layer 7: Testing Layer
Production test suite for RAG correctness:
1. Document parsing & chunking (Layer 3)
2. Semantic embedding & top-k retrieval accuracy (Layer 4)
3. API correctness & schema validation (Layers 2 & 6)
4. Database audit trail integrity (Layer 5)
"""
import os
import sys
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Ensure api root is on python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from app.core.database import AsyncSessionLocal, engine, Base
from app.rag.doc_parser import chunk_document, clean_text
from app.rag.embeddings import get_embedding, cosine_similarity
from app.rag.vector_store import index_parsed_chunks, retrieve_top_k
from app.models.models import RAGDocument, RAGChunk, RAGQueryLog

@pytest.fixture(scope="session", autouse=True)
def anyio_backend():
    return "asyncio"

@pytest.mark.asyncio
async def test_layer3_doc_chunking():
    """Verifies that the mock guideline file is parsed into distinct sections"""
    raw_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "knowledge_base", "raw", "hcl_techbee_evaluation_guidelines_2026.txt"
    )
    assert os.path.exists(raw_path), "Mock guideline file must exist"
    
    chunks = chunk_document(raw_path)
    assert len(chunks) >= 5, f"Expected at least 5 sections, got {len(chunks)}"
    
    section_titles = [c["section_title"] for c in chunks]
    assert any("SEGMENT 1" in t for t in section_titles)
    assert any("SEGMENT 4" in t for t in section_titles)
    assert all(c["token_count"] > 0 for c in chunks)
    print(f"\n[Layer 3 Pass] Parsed {len(chunks)} chunks with titles: {section_titles[:3]}...")

@pytest.mark.asyncio
async def test_layer4_vector_embedding_and_retrieval():
    """Verifies vector calculation and semantic top-k match"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    raw_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "knowledge_base", "raw", "hcl_techbee_evaluation_guidelines_2026.txt"
    )
    chunks = chunk_document(raw_path)

    async with AsyncSessionLocal() as db:
        # Ingest
        doc = await index_parsed_chunks(db, filename="test_guidelines.txt", file_path=raw_path, chunks=chunks)
        assert doc.id is not None
        assert doc.total_chunks == len(chunks)

        # Retrieve for email deductions
        results = await retrieve_top_k(db, query="What is the penalty for missing salutation in email?", top_k=2)
        assert len(results) > 0
        top_match = results[0]
        
        # Must retrieve Segment 4 (Email writing)
        assert "SEGMENT 4" in top_match["section_title"] or "email" in top_match["content"].lower()
        assert top_match["similarity_score"] >= 0.25
        print(f"\n[Layer 4 Pass] Query successfully matched: {top_match['section_title']} (score: {top_match['similarity_score']})")

@pytest.mark.asyncio
async def test_layer2_and_layer6_api_correctness():
    """Verifies end-to-end REST API pipeline: POST /api/rag/query"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Trigger ingestion
        ingest_res = await client.post("/api/rag/ingest")
        assert ingest_res.status_code in [200, 201]
        data = ingest_res.json()
        assert data["status"] == "success"

        # 2. Query RAG system
        query_payload = {
            "query": "What is the optimal speaking rate in words per minute for oral communication?",
            "top_k": 3
        }
        query_res = await client.post("/api/rag/query", json=query_payload)
        assert query_res.status_code == 200
        q_data = query_res.json()
        assert "answer" in q_data
        assert len(q_data["retrieved_chunks"]) > 0
        assert q_data["metrics"]["latency_ms"] > 0
        print(f"\n[Layer 2 & 6 Pass] API answered query in {q_data['metrics']['latency_ms']} ms")

@pytest.mark.asyncio
async def test_layer5_database_audit_integrity():
    """Verifies that RAGQueryLog records the query, chunks retrieved, and token reduction in DB"""
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select, desc
        stmt = select(RAGQueryLog).order_by(desc(RAGQueryLog.created_at)).limit(1)
        res = await db.execute(stmt)
        latest_log = res.scalar_one_or_none()

        assert latest_log is not None, "Query log must be persisted in database"
        assert latest_log.query_text is not None
        assert latest_log.tokens_saved_estimate >= 0
        print(f"\n[Layer 5 Pass] Audit verified in DB: Query '{latest_log.query_text[:40]}...' logged with ~{latest_log.tokens_saved_estimate} tokens saved.")
