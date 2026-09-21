"""
Application configuration — reads from .env file
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_NAME: str = "Techbee Chronicle AI Interview Platform"
    APP_VERSION: str = "1.0.0"
    SECRET_KEY: str = "change-me-in-production"
    API_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        return [
            self.FRONTEND_URL,        # http://localhost:3000 (Next.js)
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:8000",   # FastAPI itself (for same-origin PDF serve)
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000",
            "https://teams.microsoft.com",
            "https://teams.microsoft.com/",
            "https://*.teams.microsoft.com",
        ]

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./techbee_interviews.db"
    DATABASE_URL_SYNC: str = "sqlite:///./techbee_interviews.db"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Microsoft Azure AD / Teams SSO ───────────────────────────────────────
    AZURE_TENANT_ID: str = ""
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""

    @property
    def AZURE_AUTHORITY(self) -> str:
        return f"https://login.microsoftonline.com/{self.AZURE_TENANT_ID}"

    @property
    def AZURE_JWKS_URL(self) -> str:
        return f"https://login.microsoftonline.com/{self.AZURE_TENANT_ID}/discovery/v2.0/keys"

    # ── Google Cloud ──────────────────────────────────────────────────────────
    GOOGLE_APPLICATION_CREDENTIALS: str = "./service-account.json"
    GCS_BUCKET_NAME: str = "techbee-interview-recordings"
    GCS_BUCKET_REPORTS: str = "techbee-interview-reports"
    GCP_PROJECT_ID: str = ""
    GCP_REGION: str = "asia-south1"

    # ── AWS Cloud Storage (S3) ────────────────────────────────────────────────
    AWS_REGION: str = "ap-southeast-2"
    AWS_S3_BUCKET_NAME: str = "ai-interview-ajay-dev"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    STORAGE_PROVIDER: str = "aws_s3"

    # ── Auth / Domain Restriction ─────────────────────────────────────────────
    # Only email addresses from this domain can be auto-provisioned as HR users.
    # Set to "" to disable domain restriction (not recommended for production).
    ALLOWED_HR_DOMAIN: str = "hcltech.com"

    # ── Gemini AI ─────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"

    # ── OpenAI (Whisper STT) ──────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""

    # ── Simli.ai (Avatar) ─────────────────────────────────────────────────────
    SIMLI_API_KEY: str = ""
    SIMLI_FACE_ID: str = "aria-professional-v1"

    # ── Google TTS (Aria's Voice) ─────────────────────────────────────────────
    GOOGLE_TTS_VOICE_NAME: str = "en-IN-Neural2-A"
    GOOGLE_TTS_LANGUAGE_CODE: str = "en-IN"

    # ── Email / SMTP (Interview Invitations) ──────────────────────────────
    # Configured by HR admin once techbeechronical@hcltech.com is provisioned
    SMTP_HOST: str = "smtp.office365.com"       # For HCL Outlook / Office 365
    SMTP_PORT: int = 587                         # TLS port (STARTTLS)
    SMTP_USER: str = ""                          # e.g. techbeechronical@hcltech.com
    SMTP_PASS: str = ""                          # App password (not account password)
    SMTP_FROM: str = "TechBee Chronicle HR <techbeechronical@hcltech.com>"
    SMTP_ENABLED: bool = False                   # Set True once credentials are ready

    @property
    def smtp_configured(self) -> bool:
        """True only when all required SMTP fields are filled."""
        return bool(self.SMTP_USER and self.SMTP_PASS and self.SMTP_ENABLED)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
