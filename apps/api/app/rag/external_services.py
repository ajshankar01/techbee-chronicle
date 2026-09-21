"""
Layer 6: External Services Layer
Manages LLM provider connectivity (Google Gemini / Groq / OpenAI), health checks, and fallback logic.
"""
import os
import logging
from typing import Dict, Any, Optional
import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)

def check_llm_health() -> Dict[str, Any]:
    """
    Health check for LLM provider connectivity.
    """
    status = {
        "provider": "google_gemini",
        "model": settings.GEMINI_MODEL,
        "configured": bool(settings.GEMINI_API_KEY),
        "status": "offline"
    }
    
    if not settings.GEMINI_API_KEY:
        status["message"] = "GEMINI_API_KEY is not set."
        return status
        
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        # Test lightweight ping
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        resp = model.generate_content("ping", generation_config={"max_output_tokens": 5})
        if resp and resp.text:
            status["status"] = "healthy"
            status["message"] = "Connected successfully to Gemini."
        else:
            status["status"] = "degraded"
            status["message"] = "Model returned empty response."
    except Exception as e:
        status["status"] = "error"
        status["message"] = str(e)
        logger.warning(f"LLM health check failed: {e}")
        
    return status

async def generate_grounded_response(prompt: str, context_chunks: list) -> str:
    """
    Generates an answer strictly grounded in the retrieved context.
    Prevents hallucination by constraining prompt instructions.
    """
    if not context_chunks:
        return "No relevant HCL TechBee evaluation policy was found in the knowledge base to answer this query."

    context_str = "\n\n---\n\n".join([
        f"[Source: {c.get('filename')} | Section: {c.get('section_title')}]\n{c.get('content')}"
        for c in context_chunks
    ])

    system_instruction = (
        "You are the HCL TechBee Enterprise HR Knowledge & Interview Evaluation Assistant.\n"
        "Your task is to answer HR queries strictly based on the retrieved policy context provided below.\n"
        "Ground rules:\n"
        "1. Base your answer ONLY on the provided context.\n"
        "2. Always cite the specific Section or Criteria mentioned in the text.\n"
        "3. If the answer is not contained in the context, explicitly state: "
        "'This detail is not specified in the current TechBee Evaluation Guidelines.'\n"
        "4. Be concise, professional, and audit-ready."
    )

    full_prompt = (
        f"{system_instruction}\n\n"
        f"RETRIEVED CONTEXT CHUNKS:\n{context_str}\n\n"
        f"HR QUERY: {prompt}\n\n"
        f"GROUNDED ANSWER:"
    )

    if settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("mock"):
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(settings.GEMINI_MODEL)
            resp = model.generate_content(
                full_prompt,
                generation_config={"temperature": 0.2, "max_output_tokens": 500}
            )
            if resp and resp.text:
                return resp.text.strip()
        except Exception as e:
            logger.warning(f"Gemini grounded generation failed: {e}. Falling back to deterministic extractive synthesizer.")

    # Resilient fallback synthesis when API is offline or key is inactive:
    # Extracts the most relevant sentences directly from top chunk
    top_chunk = context_chunks[0]
    return (
        f"**Based on {top_chunk.get('section_title', 'TechBee Rubric')} ({top_chunk.get('filename')}):**\n\n"
        f"{top_chunk.get('content')[:400]}...\n\n"
        f"*(Grounded extraction via Layer 4 semantic retrieval)*"
    )
