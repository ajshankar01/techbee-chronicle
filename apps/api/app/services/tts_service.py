"""
Text-to-Speech Service — Google Cloud TTS Neural2 (Aria's voice)
"""
import base64
import logging
import hashlib
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

_CACHE_DIR = Path("tts_cache")
try:
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

texttospeech = None
try:
    from google.cloud import texttospeech
except Exception as e:
    logger.warning(f"Google TTS SDK import skipped: {e}")
    texttospeech = None

_tts_client = None


def _get_client():
    global _tts_client
    if _tts_client is None and texttospeech is not None:
        try:
            _tts_client = texttospeech.TextToSpeechClient()
        except Exception as e:
            logger.warning(f"Failed to create TTS client: {e}")
    return _tts_client


async def synthesize_aria_speech(
    text: str,
    speaking_rate: float = 0.92,
    pitch: float = 0.0,
) -> bytes:
    """Synthesize speech audio or return empty bytes if SDK unconfigured"""
    client = _get_client()
    if not client or not texttospeech:
        return b""

    try:
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code=settings.GOOGLE_TTS_LANGUAGE_CODE,
            name=settings.GOOGLE_TTS_VOICE_NAME,
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=speaking_rate,
            pitch=pitch,
        )
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )
        return response.audio_content
    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}")
        return b""


async def synthesize_aria_speech_b64(text: str) -> str:
    audio_bytes = await synthesize_aria_speech(text)
    return base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else ""
