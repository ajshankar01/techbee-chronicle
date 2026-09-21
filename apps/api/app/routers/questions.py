"""
Questions Router — Cognitive and Psychometric Question Management
"""
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.core.auth import get_current_hr_user
from app.models.models import HRUser, CognitiveQuestion, CognitiveDomain, PsychometricQuestion
from app.services.gemini_service import generate_cognitive_mcq, generate_psychometric_statement, generate_15_psychometric_batch

logger = logging.getLogger(__name__)
router = APIRouter()

class CreateCognitiveRequest(BaseModel):
    domain: str
    question_text: str
    options: List[str]
    correct_answer_index: int

class CreatePsychometricRequest(BaseModel):
    trait: str
    statement_text: str


@router.get("/cognitive", summary="Get all cognitive questions")
async def get_cognitive(
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    query = select(CognitiveQuestion).where(CognitiveQuestion.is_active == True).order_by(CognitiveQuestion.id)
    result = await db.execute(query)
    questions = result.scalars().all()
    
    return [
        {
            "id": str(q.id),
            "domain": q.domain.value,
            "question_text": q.question_text,
            "options": q.options,
            "correct_answer_index": q.correct_answer_index,
        }
        for q in questions
    ]


@router.post("/cognitive", summary="Add a cognitive question")
async def add_cognitive(
    req: CreateCognitiveRequest,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    try:
        domain_enum = CognitiveDomain(req.domain)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid cognitive domain")
        
    q = CognitiveQuestion(
        domain=domain_enum,
        question_text=req.question_text,
        options=req.options,
        correct_answer_index=req.correct_answer_index,
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return {"id": str(q.id), "message": "Cognitive question added"}


@router.delete("/cognitive/{id}", summary="Delete a cognitive question")
async def delete_cognitive(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    try:
        q_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    result = await db.execute(select(CognitiveQuestion).where(CognitiveQuestion.id == q_uuid))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    await db.delete(question)
    await db.commit()
    return {"message": "Cognitive question deleted"}


@router.get("/psychometric", summary="Get all psychometric questions")
async def get_psychometric(
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    query = select(PsychometricQuestion).where(PsychometricQuestion.is_active == True).order_by(PsychometricQuestion.id)
    result = await db.execute(query)
    questions = result.scalars().all()
    
    return [
        {
            "id": str(q.id),
            "trait": q.trait,
            "statement_text": q.statement_text,
        }
        for q in questions
    ]


@router.post("/psychometric", summary="Add a psychometric question")
async def add_psychometric(
    req: CreatePsychometricRequest,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    q = PsychometricQuestion(
        trait=req.trait,
        statement_text=req.statement_text,
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return {"id": str(q.id), "message": "Psychometric question added"}


@router.delete("/psychometric/{id}", summary="Delete a psychometric question")
async def delete_psychometric(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    try:
        q_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    result = await db.execute(select(PsychometricQuestion).where(PsychometricQuestion.id == q_uuid))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    await db.delete(question)
    await db.commit()
    return {"message": "Psychometric question deleted"}


@router.post("/generate/cognitive", summary="AI-generate a cognitive question")
async def ai_generate_cognitive(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    try:
        domain_enum = CognitiveDomain(domain)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid cognitive domain")
        
    res = await db.execute(select(CognitiveQuestion).where(CognitiveQuestion.domain == domain_enum))
    existing_texts = [q.question_text for q in res.scalars().all()]
    
    result = await generate_cognitive_mcq(domain_enum.value, existing_texts)
    return result


@router.post("/generate/psychometric", summary="AI-generate a psychometric statement")
async def ai_generate_psychometric(
    trait: str,
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    res = await db.execute(select(PsychometricQuestion).where(PsychometricQuestion.trait == trait))
    existing_texts = [q.statement_text for q in res.scalars().all()]
    
    result = await generate_psychometric_statement(trait, existing_texts)
    return result


@router.post("/psychometric/generate-batch", summary="AI-generate 15 psychometric questions directly into Question Bank")
async def ai_generate_and_ingest_15_psychometric(
    db: AsyncSession = Depends(get_db),
    current_hr: HRUser = Depends(get_current_hr_user),
):
    """
    Generates a balanced batch of 15 workplace psychometric statements
    (3 per trait across Adaptability, Resilience, Collaboration, Conscientiousness, Growth Mindset)
    and saves them directly into the PostgreSQL Question Bank.
    """
    res = await db.execute(select(PsychometricQuestion.statement_text))
    existing_texts = [row[0] for row in res.all() if row[0]]
    
    batch_qs = await generate_15_psychometric_batch(existing_statements=existing_texts)
    
    saved_items = []
    for item in batch_qs:
        text = item.get("statement_text", "").strip()
        trait = item.get("trait", "").strip()
        if not text or not trait:
            continue
        # Avoid exact duplicate
        if any(text.lower() == e.lower() for e in existing_texts):
            continue
            
        pq = PsychometricQuestion(
            trait=trait,
            statement_text=text,
            is_active=True
        )
        db.add(pq)
        existing_texts.append(text)
        saved_items.append({"trait": trait, "statement_text": text})
        
    await db.commit()
    
    return {
        "message": f"Successfully generated and added {len(saved_items)} psychometric questions to the Question Bank!",
        "count": len(saved_items),
        "questions": saved_items
    }

