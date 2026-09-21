"""
Async SQLAlchemy database engine and session factory
Supports: SQLite (local dev) + PostgreSQL/AWS RDS (production)
"""
import ssl
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ── Build engine kwargs based on dialect ──────────────────────────────────────
is_sqlite = "sqlite" in settings.DATABASE_URL
is_postgres = "postgresql" in settings.DATABASE_URL

engine_kwargs = {
    "echo": settings.APP_ENV == "development",
}

if is_sqlite:
    # SQLite — local dev, no pool settings needed
    engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

elif is_postgres:
    # PostgreSQL / AWS RDS — SSL required + optimized connection pool
    connect_args = {}

    # AWS RDS requires SSL — use a permissive context that works without cert bundle
    if "rds.amazonaws.com" in settings.DATABASE_URL:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE   # For dev; swap to CERT_REQUIRED + cert bundle in prod
        connect_args["ssl"] = ssl_ctx

    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,      # Detects stale connections before use
        pool_size=10,            # Persistent connections in pool
        max_overflow=20,         # Extra connections under burst load
        pool_recycle=1800,       # Recycle connections every 30 mins (avoids RDS idle timeout)
        pool_timeout=30,         # Wait up to 30s for a free connection
        connect_args=connect_args,
        **engine_kwargs,
    )
else:
    engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)


# ── Session factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
