"""
TechBee AI Interview Platform — FastAPI Backend
Main application entry point with Sentry Monitoring & Production Security
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import interview, analysis, reports, hr, auth, questions, websocket_router, s3_assets, batches, rag

# Sentry Error Monitoring Integration
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
            integrations=[
                StarletteIntegration(),
                FastApiIntegration(),
            ],
            environment=settings.APP_ENV,
        )
        logging.info("⚡ Sentry Error Monitoring initialized for production")
    except Exception as e:
        logging.warning(f"Sentry init warning: {e}")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s — %(name)s — %(levelname)s — %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle"""
    logger.info("🚀 Starting TechBee AI Interview Platform API...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables initialized")

    try:
        from app.core.database import AsyncSessionLocal
        from app.core.seeder import seed_question_bank
        async with AsyncSessionLocal() as db:
            await seed_question_bank(db)
    except Exception as e:
        logger.warning(f"Failed to seed question bank on startup: {e}")

    try:
        from app.services.storage_service import ensure_buckets_exist
        ensure_buckets_exist()
    except Exception as e:
        logger.info(f"Storage init status: {e}")

    try:
        from app.services.gemini_service import _get_gemini_client
        _get_gemini_client()
        logger.info("⚡ Gemini AI client warmed up on startup")
    except Exception as e:
        logger.warning(f"Failed to pre-warm Gemini client: {e}")

    yield
    logger.info("🛑 Shutting down API...")


app = FastAPI(
    title="TechBee AI Interview Platform API",
    description="Enterprise AI Interview System for TechBee Candidates",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.APP_ENV == "development" else None,
    redoc_url="/api/redoc" if settings.APP_ENV == "development" else None,
)


# ── Rate Limiting (slowapi) ───────────────────────────────────────────────────
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    logger.info("✅ Rate limiting active (slowapi)")
except ImportError:
    logger.warning("⚠️ slowapi not installed — rate limiting disabled. Run: pip install slowapi")


# Security Headers & Teams iFrame Embedding Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # Prevent MIME-type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Legacy XSS filter (belt-and-suspenders alongside CSP)
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Prevent clickjacking — Teams embedding allowed, all others blocked
    response.headers["X-Frame-Options"] = "ALLOW-FROM https://teams.microsoft.com"
    # Do not send Referer to external origins
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Restrict camera/mic/geolocation to same-origin only
    response.headers["Permissions-Policy"] = (
        "camera=(self), microphone=(self), geolocation=()"
    )
    # Content Security Policy — scoped WebSocket origins (no bare wss:)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        f"frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com; "
        "media-src 'self' blob: data:; "
        f"connect-src 'self' {settings.API_BASE_URL.replace('http', 'ws')} "
        f"{settings.API_BASE_URL.replace('https', 'wss')} {settings.API_BASE_URL} https:;"
    )
    return response


# Middleware
# Note: FastAPI executes middleware in reverse order of registration.
# CORSMiddleware must be added last so it executes FIRST on incoming requests
# and wraps ALL outgoing responses (including 500 exceptions) with CORS headers.
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)


# Routers
app.include_router(auth.router)
app.include_router(analysis.router)
app.include_router(reports.router)
app.include_router(hr.router, prefix="/api/hr", tags=["HR Management"])
app.include_router(batches.router, prefix="/api/hr", tags=["Batch Scheduling"])
app.include_router(interview.router, prefix="/api/interview", tags=["Interview"])
app.include_router(questions.router, prefix="/api/questions", tags=["Questions"])
app.include_router(websocket_router.router, prefix="/ws", tags=["WebSocket"])
app.include_router(s3_assets.router)
app.include_router(rag.router)

# TTS — Microsoft Edge Neural TTS (captures Aria voice in recording)
from app.routers import tts as tts_router
app.include_router(tts_router.router)


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "sentry_active": bool(SENTRY_DSN),
    }
