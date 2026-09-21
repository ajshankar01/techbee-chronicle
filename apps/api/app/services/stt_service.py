"""
Speech-to-Text Service — OpenAI Whisper API (streaming via chunked audio)
Handles real-time transcription of candidate responses during interviews
"""
import io
import logging
import asyncio
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def transcribe_audio_chunk(
    audio_bytes: bytes,
    language: str = "en",
    session_id: str = "",
) -> dict:
    """
    Transcribe a chunk of audio (WAV/WebM) using OpenAI Whisper.
    Called during interview for each candidate speech segment.

    Returns:
        {
            "text": "transcribed text",
            "language": "en",
            "duration": 3.5,
            "words": [...],   # word-level timestamps if available
            "is_final": True
        }
    """
    if not audio_bytes or len(audio_bytes) < 1000:
        return {"text": "", "is_final": True}

    try:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "audio.webm"

        response = await _client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=language,
            response_format="verbose_json",
            timestamp_granularities=["word"],
        )

        return {
            "text": response.text.strip(),
            "language": response.language,
            "duration": response.duration,
            "words": [
                {"word": w.word, "start": w.start, "end": w.end}
                for w in (response.words or [])
            ],
            "is_final": True,
        }

    except Exception as e:
        logger.error(f"Whisper transcription failed [session={session_id}]: {e}")
        return {"text": "", "is_final": True, "error": str(e)}


async def transcribe_full_response(
    audio_bytes: bytes,
    prompt: str = "",
    session_id: str = "",
) -> str:
    """
    Transcribe a complete candidate response after they click 'Done Speaking'.
    Uses prompt context to improve accuracy for interview domain.
    """
    if not audio_bytes:
        return ""

    try:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "response.webm"

        response = await _client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en",
            prompt=prompt or "This is a job interview response. The candidate is speaking in English.",
            response_format="text",
        )

        text = response.strip() if isinstance(response, str) else response.text.strip()
        logger.info(f"Transcribed {len(text.split())} words [session={session_id}]")
        return text

    except Exception as e:
        logger.error(f"Whisper full transcription failed [session={session_id}]: {e}")
        return ""
