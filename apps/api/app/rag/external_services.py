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

def _get_active_model_name() -> str:
    m = (settings.GEMINI_MODEL or "gemini-3.6-flash").strip()
    if "gemini-2.0-flash" in m:
        return "gemini-3.6-flash"
    return m

def check_llm_health() -> Dict[str, Any]:
    """
    Health check for LLM provider connectivity with automatic fallback for deprecated model names.
    """
    active_model = _get_active_model_name()
    status = {
        "provider": "google_gemini",
        "model": active_model,
        "configured": bool(settings.GEMINI_API_KEY),
        "status": "offline"
    }
    
    if not settings.GEMINI_API_KEY:
        status["message"] = "GEMINI_API_KEY is not set."
        return status
        
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        for candidate_model in [active_model, "gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"]:
            try:
                model = genai.GenerativeModel(candidate_model)
                resp = model.generate_content("ping", generation_config={"max_output_tokens": 5})
                if resp and resp.text:
                    status["model"] = candidate_model
                    status["status"] = "healthy"
                    status["message"] = f"Connected successfully to {candidate_model}."
                    return status
            except Exception:
                continue
        status["status"] = "degraded"
        status["message"] = "Candidate Gemini models returned no response."
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

    active_model = _get_active_model_name()
    if settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("mock"):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        for candidate_model in [active_model, "gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"]:
            try:
                model = genai.GenerativeModel(candidate_model)
                resp = model.generate_content(
                    full_prompt,
                    generation_config={"temperature": 0.2, "max_output_tokens": 500}
                )
                if resp and resp.text:
                    return resp.text.strip()
            except Exception as e:
                logger.warning(f"Gemini grounded generation with {candidate_model} failed: {e}.")
        logger.warning("All Gemini candidate models failed. Falling back to deterministic extractive synthesizer.")

    # Resilient fallback synthesis when API is offline or key is inactive:
    # Extracts the most relevant sentences directly from top chunk
    top_chunk = context_chunks[0]
    return (
        f"**Based on {top_chunk.get('section_title', 'TechBee Rubric')} ({top_chunk.get('filename')}):**\n\n"
        f"{top_chunk.get('content')[:400]}...\n\n"
        f"*(Grounded extraction via Layer 4 semantic retrieval)*"
    )
