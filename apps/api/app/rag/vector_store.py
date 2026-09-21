"""
Layer 4: Vector Store & Retrieval Layer
Stores embeddings and executes top-k similarity search across indexed chunks.
"""
from typing import List, Dict, Any, Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import RAGDocument, RAGChunk
from app.rag.embeddings import get_embedding, cosine_similarity

async def index_parsed_chunks(db: AsyncSession, filename: str, file_path: str, chunks: List[Dict[str, Any]]) -> RAGDocument:
    """
    Persists document and all its embedded chunks to the database.
    Replaces existing document chunks if already ingested.
    """
    # Check if doc already exists
    stmt = select(RAGDocument).where(RAGDocument.filename == filename)
    res = await db.execute(stmt)
    existing_doc = res.scalar_one_or_none()
    
    if existing_doc:
        await db.delete(existing_doc)
        await db.flush()

    doc = RAGDocument(
        id=uuid.uuid4(),
        filename=filename,
        file_path=file_path,
        total_chunks=len(chunks)
    )
    db.add(doc)
    await db.flush()

    for item in chunks:
        vec = get_embedding(item["content"])
        chunk_obj = RAGChunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            chunk_index=item["chunk_index"],
            section_title=item.get("section_title"),
            content=item["content"],
            embedding_json=vec,
            token_count=item.get("token_count", 0)
        )
        db.add(chunk_obj)

    await db.commit()
    await db.refresh(doc)
    return doc

async def retrieve_top_k(db: AsyncSession, query: str, top_k: int = 3, min_score: float = 0.25) -> List[Dict[str, Any]]:
    """
    Retrieves the most semantically relevant chunks for a user query.
    Calculates cosine similarity against all indexed chunk embeddings.
    """
    query_vec = get_embedding(query)
    
    stmt = select(RAGChunk, RAGDocument.filename).join(RAGDocument, RAGChunk.document_id == RAGDocument.id)
    res = await db.execute(stmt)
    rows = res.all()
    
    scored_chunks = []
    for chunk, filename in rows:
        if not chunk.embedding_json:
            continue
        score = cosine_similarity(query_vec, chunk.embedding_json)
        scored_chunks.append({
            "chunk_id": str(chunk.id),
            "chunk_index": chunk.chunk_index,
            "section_title": chunk.section_title or "Guideline Excerpt",
            "filename": filename,
            "content": chunk.content,
            "token_count": chunk.token_count,
            "similarity_score": round(score, 4)
        })

    # Sort descending by similarity
    scored_chunks.sort(key=lambda x: x["similarity_score"], reverse=True)
    
    # Return top-k matches
    top_results = [c for c in scored_chunks if c["similarity_score"] >= min_score][:top_k]
    
    # If no results meet min_score, fallback to top-1 if any exist
    if not top_results and scored_chunks:
        top_results = [scored_chunks[0]]
        
    return top_results
