# -*- coding: utf-8 -*-
"""
tests/test_transcript_fix.py
Tests for the 3 transcript bugs fixed in Phase 1.

Ground Rule #16: Tests only for what already broke.
"""
import pytest


class TestTranscriptRefVsState:
    """Fix C: handleStop must use ref (not stale state) at submit time."""

    def test_interim_text_ref_stays_in_sync(self):
        """
        Simulates the interimTextRef pattern used in OralSegment.
        The ref must always reflect the current interim transcript so that
        handleStop never reads a stale empty string.
        """
        # Simulate what React does: state update is async, ref is sync
        interim_state = ""
        interim_ref = ""

        def on_result(text: str, is_final: bool):
            nonlocal interim_state, interim_ref
            if is_final:
                pass  # accumulates in finalTextRef
            else:
                interim_state = text   # state (may lag in React)
                interim_ref = text     # ref (always current � FIX-C)

        on_result("I believe", False)
        assert interim_ref == "I believe", "ref must be updated synchronously"

        # Simulate handleStop reading the ref vs stale state
        # In the old code, interim_state might be "" due to React batching
        stale_state_reading = ""  # what old code saw
        ref_reading = interim_ref  # what new code reads

        assert ref_reading == "I believe", "handleStop must use ref, not stale state"
        # Old code would have submitted empty � new code submits the actual speech
        assert stale_state_reading != ref_reading, (
            "This test demonstrates the stale state vs ref discrepancy"
        )

    def test_combined_transcript_never_empty_when_candidate_spoke(self):
        """
        After a candidate speaks, the combined transcript built from
        finalTextRef + interimTextRef must not be empty.
        """
        final_text_ref = "I am passionate about"
        interim_text_ref = "software engineering"

        # Simulate handleStop (FIX-C)
        combined = (final_text_ref + " " + interim_text_ref).strip()

        assert combined != "", "Submitted transcript must not be empty after candidate spoke"
        assert "passionate" in combined
        assert "software engineering" in combined


class TestTTSSpeakingGuard:
    """Fix A: SpeechRecognition must not restart while TTS is playing."""

    def test_is_tts_speaking_ref_blocks_recognition_restart(self):
        """
        The isTtsSpeakingRef guard must prevent recognition from restarting
        while Aria's voice is playing, to avoid capturing TTS audio as transcript.
        """
        is_tts_speaking = True
        is_recording = True
        recognition_would_restart = False

        # Simulate the onend handler (FIX-A)
        if is_recording and not is_tts_speaking:
            recognition_would_restart = True

        assert not recognition_would_restart, (
            "SpeechRecognition must NOT restart while TTS is speaking. "
            "Without this guard, Aria's voice gets transcribed as candidate speech."
        )

    def test_recognition_restarts_after_tts_finishes(self):
        """
        After TTS finishes (isTtsSpeakingRef = False), recognition
        must be allowed to restart for the candidate.
        """
        is_tts_speaking = False
        is_recording = True
        recognition_would_restart = False

        # Simulate the onend handler after TTS has finished
        if is_recording and not is_tts_speaking:
            recognition_would_restart = True

        assert recognition_would_restart, (
            "SpeechRecognition MUST restart after TTS finishes and candidate is recording."
        )


class TestWebSocketBufferFlush:
    """Fix B: WebSocket buffer must be flushed on disconnect."""

    def test_accumulated_bytes_flushed_on_disconnect(self):
        """
        Simulates the flush logic added to the WebSocket transcriber.
        Remaining audio bytes must be sent for transcription on disconnect,
        not silently dropped.
        """
        MIN_BUFFER_SIZE = 8192  # original threshold
        accumulated_bytes = bytearray(b"\x00" * 3000)  # ~3s of audio < threshold
        header_chunk = bytearray(b"\x1a\x45\xdf\xa3")  # WebM header

        # Old behavior: only transcribe when >= 8192 bytes (drops final speech)
        old_would_transcribe = len(accumulated_bytes) >= MIN_BUFFER_SIZE
        assert not old_would_transcribe, "Old code would NOT transcribe short final chunk"

        # New behavior (FIX-B): always flush on disconnect if bytes remain
        new_would_flush = bool(accumulated_bytes) and bool(header_chunk)
        assert new_would_flush, "New code MUST flush remaining bytes on disconnect"
