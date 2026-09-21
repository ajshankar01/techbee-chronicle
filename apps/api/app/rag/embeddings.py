"""
Layer 4: Embedding Layer
Computes semantic embeddings using Google Gemini text-embedding-004
with a deterministic normalized hashing fallback for offline/isolated tests.
"""
import math
import logging
from typing import List
import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure Gemini if key is provided
if settings.GEMINI_API_KEY:
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
    except Exception as e:
        logger.warning(f"Failed to configure genai in embeddings layer: {e}")

def _fallback_hash_embedding(text: str, dim: int = 128) -> List[float]:
    """
    Deterministic normalized vector fallback ensuring offline stability and fast unit testing.
    """
    vec = [0.0] * dim
    for i, word in enumerate(text.lower().split()):
        val = sum(ord(c) for c in word)
        idx = val % dim
        vec[idx] += 1.0 / (1.0 + (i * 0.05))
        
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [round(x / norm, 5) for x in vec]

def get_embedding(text: str) -> List[float]:
    """
    Computes embedding vector for input text string.
    Tries Google Gemini API first; falls back gracefully.
    """
    if not text.strip():
        return [0.0] * 128

    if settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("mock"):
        try:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document"
            )
            emb = result.get("embedding")
            if emb and isinstance(emb, list):
                # Normalize vector
                norm = math.sqrt(sum(x * x for x in emb)) or 1.0
                return [round(x / norm, 6) for x in emb]
        except Exception as e:
            logger.warning(f"Gemini embedding API call failed: {e}. Using deterministic vector.")

    return _fallback_hash_embedding(text, dim=128)

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Calculates cosine similarity between two normalized vectors"""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    return max(0.0, min(1.0, float(dot_product)))
