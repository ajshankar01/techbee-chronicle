"""
TTS Router — Microsoft Edge Neural TTS (no API key required)
Converts Aria's text to MP3 audio bytes and streams to the browser.
The browser decodes via AudioContext and routes through audioDestRef
so Aria's voice gets captured inside the MediaRecorder recording.

Voice: en-IN-NeerjaNeural — Indian English, female, clear and professional
"""
import io
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import edge_tts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["tts"])

# Aria's voice — Microsoft Edge Neural TTS
ARIA_VOICE = "en-US-AriaNeural"   # US English Female — professional, clear, bold
FALLBACK_VOICE = "en-IN-NeerjaNeural"  # Indian English Female — fallback


class TTSRequest(BaseModel):
    text: str
    voice: str = ARIA_VOICE


@router.post("/speak")
async def speak(req: TTSRequest):
    """
    Convert text to speech using Microsoft Edge Neural TTS.
    Returns audio/mpeg bytes that the frontend plays through AudioContext.
    This allows Aria's voice to be captured inside the MediaRecorder recording.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    text = req.text.strip()[:800]  # Cap at 800 chars to prevent abuse
    voice = req.voice or ARIA_VOICE

    # Collect all audio chunks into a BytesIO buffer
    audio_buffer = io.BytesIO()
    try:
        communicate = edge_tts.Communicate(text, voice, rate="+2%", pitch="+0Hz")
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])
    except Exception as e:
        logger.warning(f"edge-tts with voice {voice} failed: {e}. Trying fallback...")
        # Try fallback voice
        try:
            audio_buffer = io.BytesIO()
            communicate = edge_tts.Communicate(text, FALLBACK_VOICE, rate="+2%", pitch="+0Hz")
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_buffer.write(chunk["data"])
        except Exception as e2:
            logger.error(f"TTS fallback also failed: {e2}")
            raise HTTPException(status_code=500, detail=f"TTS generation failed: {e2}")


    audio_bytes = audio_buffer.getvalue()
    if not audio_bytes:
        raise HTTPException(status_code=500, detail="TTS produced no audio output")

    logger.info(f"✅ TTS generated {len(audio_bytes)} bytes for: {text[:50]}...")
    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "Content-Length": str(len(audio_bytes)),
            "X-Voice": voice,
        }
    )


@router.get("/voices")
async def list_voices():
    """List available Edge TTS voices filtered to English."""
    try:
        voices = await edge_tts.list_voices()
        english_voices = [
            {"name": v["Name"], "short": v["ShortName"], "gender": v["Gender"], "locale": v["Locale"]}
            for v in voices if v["Locale"].startswith("en-")
        ]
        return {"voices": english_voices, "recommended": ARIA_VOICE}
    except Exception as e:
        logger.error(f"Failed to list voices: {e}")
        return {"voices": [], "recommended": ARIA_VOICE, "error": str(e)}
