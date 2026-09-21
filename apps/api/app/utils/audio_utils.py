"""
Audio processing utilities for WebM to WAV conversion and silence detection.
"""
import io
import pydub
from pydub.silence import detect_silence as pydub_detect_silence

def convert_webm_to_wav(audio_bytes: bytes) -> bytes:
    """
    Convert WebM audio bytes to WAV bytes using pydub.
    """
    try:
        audio = pydub.AudioSegment.from_file(io.BytesIO(audio_bytes), codec="opus")
    except Exception:
        try:
            audio = pydub.AudioSegment.from_file(io.BytesIO(audio_bytes), format="webm")
        except Exception as e:
            raise ValueError(f"Failed to load audio for conversion: {e}")

    wav_io = io.BytesIO()
    audio.export(wav_io, format="wav")
    return wav_io.getvalue()

def detect_silence(audio_bytes: bytes, threshold_db: int = -40) -> bool:
    """
    Detect if the audio is mostly silence.
    Returns True if the entire clip is considered silence below the threshold.
    """
    try:
        try:
            audio = pydub.AudioSegment.from_file(io.BytesIO(audio_bytes), codec="opus")
        except Exception:
            audio = pydub.AudioSegment.from_file(io.BytesIO(audio_bytes))
            
        if len(audio) == 0:
            return True
            
        # Detect silence chunks
        min_silence_len = max(100, int(len(audio) * 0.9))
        silences = pydub_detect_silence(audio, min_silence_len=min_silence_len, silence_thresh=threshold_db)
        
        # If any silence chunk spans almost the entire audio, it's silence
        for start, end in silences:
            if (end - start) >= min_silence_len:
                return True
        return False
    except Exception:
        return False

def get_audio_duration(audio_bytes: bytes) -> float:
    """
    Get the duration of audio bytes in seconds.
    """
    try:
        try:
            audio = pydub.AudioSegment.from_file(io.BytesIO(audio_bytes), codec="opus")
        except Exception:
            audio = pydub.AudioSegment.from_file(io.BytesIO(audio_bytes))
        return len(audio) / 1000.0
    except Exception:
        return 0.0

def validate_audio_format(audio_bytes: bytes) -> str:
    """
    Validate audio format by trying to load it. Returns the presumed format or 'invalid'.
    """
    try:
        # Check signature for webm/mkv
        if audio_bytes.startswith(b'\x1a\x45\xdf\xa3'):
            return "webm"
        elif audio_bytes.startswith(b'RIFF'):
            return "wav"
        elif audio_bytes.startswith(b'ID3') or audio_bytes.startswith(b'\xff\xfb'):
            return "mp3"
        return "unknown"
    except Exception:
        return "invalid"
