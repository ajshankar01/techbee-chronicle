"""
WebSocket Router — Real-time interview vision_alignment
Handles live transcript streaming, behavioral data ingestion, and proctoring events
"""
import uuid
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.models import InterviewSession, ProctoringViolation, ViolationType

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Connection Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    """Manages active WebSocket connections per session"""

    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)
        logger.info(f"WS connected: session={session_id}, total={len(self.active_connections[session_id])}")

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        logger.info(f"WS disconnected: session={session_id}")

    async def broadcast_to_session(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass


manager = ConnectionManager()


# ── Audio Transcriber WebSocket Endpoint ──────────────────────────────────────

@router.websocket("/transcribe/{session_id}")
async def websocket_transcribe(websocket: WebSocket, session_id: str):
    """
    Real-Time WebSocket Audio Streaming Transcriber:
    Receives live binary audio bytes from candidate's browser every 1s,
    preserves WebM container headers, transcribes via Gemini Multimodal Speech Engine,
    and streams back real-time text!
    """
    await websocket.accept()
    logger.info(f"⚡ WebSocket Audio Transcriber Connected for session: {session_id}")
    header_chunk: bytes | None = None
    accumulated_bytes = bytearray()

    try:
        from app.services.gemini_service import transcribe_audio_bytes

        while True:
            data = await websocket.receive_bytes()
            if not data:
                continue

            if header_chunk is None:
                header_chunk = data

            accumulated_bytes.extend(data)

            # Transcribe every ~8KB of audio (~3s of speech)
            if len(accumulated_bytes) >= 8192:
                valid_webm_file = bytes(header_chunk + accumulated_bytes)
                transcript_text = await transcribe_audio_bytes(valid_webm_file, mime_type="audio/webm")

                if transcript_text and transcript_text.strip():
                    logger.info(f"⚡ REALTIME TRANSCRIPT STREAMED: {transcript_text.strip()}")
                    await websocket.send_json({
                        "type": "transcript",
                        "text": transcript_text.strip(),
                        "is_final": True
                    })
                    accumulated_bytes = bytearray()
    except WebSocketDisconnect:
        logger.info(f"WebSocket Transcriber Disconnected for session: {session_id}")
        # FIX-B: Flush any remaining buffered audio on disconnect.
        # Previously the last ~3s of candidate speech was silently dropped
        # because transcription only fired when buffer reached 8192 bytes.
        if accumulated_bytes and header_chunk:
            try:
                leftover = bytes(header_chunk + accumulated_bytes)
                transcript_text = await transcribe_audio_bytes(leftover, mime_type="audio/webm")
                if transcript_text and transcript_text.strip():
                    logger.info(f"⚡ FLUSH TRANSCRIPT on disconnect: {transcript_text.strip()}")
                    try:
                        await websocket.send_json({
                            "type": "transcript",
                            "text": transcript_text.strip(),
                            "is_final": True,
                            "source": "disconnect_flush"
                        })
                    except Exception:
                        pass  # websocket already closed, transcript still logged
            except Exception as flush_err:
                logger.warning(f"Flush transcription failed on disconnect: {flush_err}")

    except Exception as e:
        logger.error(f"WebSocket Transcriber Exception: {e}")
        try:
            await websocket.close()
        except Exception:
            pass


# ── Main Interview WebSocket Endpoint ─────────────────────────────────────────

@router.websocket("/interview/{session_id}")
async def interview_websocket(
    websocket: WebSocket,
    session_id: str,
    role: str = Query(default="candidate"),
):
    await manager.connect(session_id, websocket)

    try:
        while True:
            raw_data = await websocket.receive_text()
            message = json.loads(raw_data)
            msg_type = message.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "transcript_chunk":
                await manager.broadcast_to_session(session_id, {
                    "type": "transcript_update",
                    "speaker": "candidate",
                    "text": message.get("text", ""),
                    "is_final": message.get("is_final", False),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

            elif msg_type == "aria_transcript":
                await manager.broadcast_to_session(session_id, {
                    "type": "transcript_update",
                    "speaker": "aria",
                    "text": message.get("text", ""),
                    "question_type": message.get("question_type", ""),
                    "is_final": True,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

            elif msg_type == "behavioral_data":
                await websocket.send_json({"type": "behavioral_ack"})

            elif msg_type == "violation":
                violation_type_str = message.get("violation_type", "tab_switch")
                timestamp_sec = message.get("session_timestamp_seconds", 0)

                async with AsyncSessionLocal() as db:
                    try:
                        violation = ProctoringViolation(
                            session_id=uuid.UUID(session_id),
                            violation_type=ViolationType(violation_type_str),
                            session_timestamp_seconds=timestamp_sec,
                            details=message.get("details"),
                        )
                        db.add(violation)
                        await db.commit()
                    except Exception as e:
                        logger.error(f"Failed to save violation: {e}")

                violation_messages = {
                    "tab_switch": "⚠️ Warning: You switched tabs. This has been recorded. Please stay on this page.",
                    "fullscreen_exit": "⚠️ Warning: Please return to full-screen mode to continue the interview.",
                    "multiple_faces": "⚠️ Warning: Multiple faces detected. Please ensure you are alone.",
                    "secondary_device": "⚠️ Warning: Another device was detected in frame. Please remove it.",
                }
                await websocket.send_json({
                    "type": "violation_warning",
                    "violation_type": violation_type_str,
                    "message": violation_messages.get(violation_type_str, "⚠️ Warning: A proctoring violation was detected."),
                    "count": message.get("count", 1),
                })

    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
        logger.info(f"Client disconnected from session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error in session {session_id}: {e}")
        manager.disconnect(session_id, websocket)
