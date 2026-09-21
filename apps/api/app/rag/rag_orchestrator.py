"""
Layer 2: API / Orchestration Layer
Coordinates end-to-end RAG pipeline: query intake -> semantic retrieval -> LLM generation -> audit logging.
"""
import time
import uuid
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import RAGQueryLog
from app.rag.vector_store import retrieve_top_k
from app.rag.external_services import generate_grounded_response

async def execute_rag_pipeline(
    db: AsyncSession,
    query: str,
    user_email: str = "hr_manager@hcltech.com",
    top_k: int = 3
) -> Dict[str, Any]:
    """
    Executes full production RAG pipeline with latency and token savings estimation.
    """
    start_time = time.time()
    
    # 1. Retrieve top-k semantically relevant chunks (Layer 4)
    retrieved_chunks = await retrieve_top_k(db, query=query, top_k=top_k)
    
    # 2. Synthesize answer with LLM Provider (Layer 6)
    answer = await generate_grounded_response(query, retrieved_chunks)
    
    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    
    # Estimate tokens saved:
    # Full corpus ~ 1,800 tokens vs Retrieved 2-3 chunks ~ 350 tokens
    retrieved_tokens = sum(c.get("token_count", 100) for c in retrieved_chunks)
    full_corpus_est = 1800
    tokens_saved = max(0, full_corpus_est - retrieved_tokens)
    
    chunk_ids = [c["chunk_id"] for c in retrieved_chunks]
    
    # 3. Log query to Database Layer (Layer 5 Audit Trail)
    log_entry = RAGQueryLog(
        id=uuid.uuid4(),
        user_email=user_email,
        query_text=query,
        retrieved_chunks_count=len(retrieved_chunks),
        retrieved_chunk_ids=chunk_ids,
        response_text=answer,
        tokens_saved_estimate=tokens_saved,
        latency_ms=elapsed_ms
    )
    db.add(log_entry)
    await db.commit()
    
    return {
        "query": query,
        "answer": answer,
        "retrieved_chunks": retrieved_chunks,
        "metrics": {
            "latency_ms": elapsed_ms,
            "tokens_saved_estimate": tokens_saved,
            "chunks_retrieved": len(retrieved_chunks)
        }
    }
