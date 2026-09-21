"""
Avatar Service — Simli.ai WebRTC integration for Aria
Manages Simli.ai session creation and audio streaming
"""
import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

SIMLI_API_BASE = "https://api.simli.ai"


async def create_simli_session(session_id: str) -> dict:
    """
    Create a new Simli.ai avatar session for Aria.
    Returns the ICE configuration and session token needed by the frontend
    to establish a WebRTC connection.

    Docs: https://docs.simli.ai/api-reference
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(
                f"{SIMLI_API_BASE}/startAudioToVideoSession",
                json={
                    "simli_api_key": settings.SIMLI_API_KEY,
                    "faceId": settings.SIMLI_FACE_ID,
                    "handleSilence": True,          # Keep avatar alive during silence
                    "maxSessionLength": 2400,        # 40 minutes max
                    "maxIdleTime": 120,              # Idle timeout 2 min
                    "metadata": {"interview_session_id": session_id},
                },
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            data = response.json()
            logger.info(f"Simli session created for interview {session_id}")
            return {
                "simli_session_token": data.get("session_token"),
                "ice_servers": data.get("iceServers", []),
                "ws_url": data.get("ws_url"),
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Simli API error: {e.response.status_code} — {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Simli session creation failed: {e}")
            raise


async def send_audio_to_avatar(
    simli_ws_url: str,
    audio_b64: str,
    session_token: str,
) -> bool:
    """
    Send TTS audio bytes to Simli.ai for lip-sync rendering.
    Called after each TTS synthesis, before Aria "speaks".

    In production this streams over WebSocket directly from the browser
    using the Simli JS SDK — this backend function is for server-side use.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                f"{SIMLI_API_BASE}/sendAudio",
                json={
                    "session_token": session_token,
                    "audio_data": audio_b64,    # base64 encoded MP3
                    "audio_format": "mp3",
                },
                headers={
                    "Authorization": f"Bearer {settings.SIMLI_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to send audio to Simli: {e}")
            return False


async def get_available_faces() -> list:
    """List available Simli.ai avatar faces for selection"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{SIMLI_API_BASE}/faces",
                headers={"Authorization": f"Bearer {settings.SIMLI_API_KEY}"},
            )
            response.raise_for_status()
            return response.json().get("faces", [])
        except Exception as e:
            logger.error(f"Failed to fetch Simli faces: {e}")
            return []
