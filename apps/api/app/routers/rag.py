"""
RAG Router (Layer 2 & 5 API Endpoints)
Exposes ingestion, query, audit logs, and external service health.
"""
import os
import glob
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import List, Optional, Any

from app.core.database import AsyncSessionLocal
from app.models.models import RAGDocument, RAGChunk, RAGQueryLog
from app.rag.doc_parser import chunk_document
from app.rag.vector_store import index_parsed_chunks
from app.rag.rag_orchestrator import execute_rag_pipeline
from app.rag.external_services import check_llm_health

router = APIRouter(prefix="/api/rag", tags=["RAG Production System"])

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3
    user_email: Optional[str] = "hr_manager@hcltech.com"

@router.post("/ingest")
async def trigger_ingestion(db: AsyncSession = Depends(get_db)):
    """
    Ingests all documents from knowledge_base/raw folder into the vector store.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    raw_dir = os.path.join(base_dir, "knowledge_base", "raw")
    
    if not os.path.exists(raw_dir):
        os.makedirs(raw_dir, exist_ok=True)
        
    pattern = os.path.join(raw_dir, "*.*")
    files = glob.glob(pattern)
    
    if not files:
        raise HTTPException(status_code=404, detail="No documents found in knowledge_base/raw/ folder.")
        
    ingested = []
    total_chunks_indexed = 0
    
    for fpath in files:
        filename = os.path.basename(fpath)
        chunks = chunk_document(fpath)
        doc = await index_parsed_chunks(db, filename=filename, file_path=fpath, chunks=chunks)
        ingested.append({
            "document_id": str(doc.id),
            "filename": doc.filename,
            "chunks_count": len(chunks)
        })
        total_chunks_indexed += len(chunks)
        
    return {
        "status": "success",
        "message": f"Successfully ingested {len(ingested)} documents ({total_chunks_indexed} chunks).",
        "documents": ingested
    }

@router.post("/query")
async def query_rag_system(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    """
    Executes grounded RAG search and audit logs result.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query string cannot be empty.")
        
    result = await execute_rag_pipeline(
        db=db,
        query=req.query,
        user_email=req.user_email or "hr_manager@hcltech.com",
        top_k=req.top_k or 3
    )
    return result

@router.get("/stats")
async def get_rag_stats(db: AsyncSession = Depends(get_db)):
    """
    Returns total indexed documents, total chunks, recent query logs, and LLM status.
    """
    # Count docs & chunks
    doc_res = await db.execute(select(RAGDocument))
    docs = doc_res.scalars().all()
    
    chunk_res = await db.execute(select(RAGChunk))
    chunks = chunk_res.scalars().all()
    
    # Recent logs
    log_res = await db.execute(select(RAGQueryLog).order_by(desc(RAGQueryLog.created_at)).limit(5))
    recent_logs = log_res.scalars().all()
    
    llm_health = check_llm_health()
    
    return {
        "total_documents": len(docs),
        "total_chunks": len(chunks),
        "documents": [{"filename": d.filename, "chunks": d.total_chunks, "id": str(d.id)} for d in docs],
        "llm_service": llm_health,
        "recent_queries": [
            {
                "query": l.query_text,
                "latency_ms": l.latency_ms,
                "tokens_saved": l.tokens_saved_estimate,
                "created_at": l.created_at.isoformat()
            }
            for l in recent_logs
        ]
    }
