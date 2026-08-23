"""
Async SQLModel engine/session, read from Settings.database_url
(knowledge-base/TECH_STACK.md §5). SQLite by default; swappable to
Postgres by changing DATABASE_URL only (SQLModel/SQLAlchemy async engine
API is the same either way) -- no code changes needed here per
knowledge-base/TECH_STACK.md §2.
"""

import asyncio
import weakref
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession as SQLModelAsyncSession

from app.config import Settings

# SQLite has no real concurrent-writer support -- StaticPool
# (create_engine_from_settings, below) serializes every session onto ONE
# connection, but concurrent AsyncSessions sharing that connection can
# still interleave transactions in ways a reader observes as
# out-of-order (e.g. a job's status flips to "completed" while a
# sibling batch's row/field writes are still in flight -- caught via a
# flaky assertion in tests/test_api.py under concurrent batches).
# This lock forces all WRITES (repository.py) through this process to
# execute one at a time, matching what SQLite actually guarantees.
# Reads are not gated -- only db/repository.py's write functions use this.
_write_locks: "weakref.WeakKeyDictionary[AsyncEngine, asyncio.Lock]" = weakref.WeakKeyDictionary()


def get_write_lock(engine: AsyncEngine) -> asyncio.Lock:
    if engine not in _write_locks:
        _write_locks[engine] = asyncio.Lock()
    return _write_locks[engine]


def _to_async_url(database_url: str) -> str:
    """Translates a plain SQLAlchemy URL to its async-driver form.
    Settings.database_url is written without a driver suffix (sqlite:///
    or postgresql://, e.g. what a Supabase connection string looks like)
    -- the async driver prefix is an implementation detail of this
    module, not something callers need to know."""
    if database_url.startswith("sqlite:///"):
        return database_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if database_url.startswith("postgres://"):
        # Supabase/Heroku-style connection strings use the "postgres://"
        # scheme, which SQLAlchemy's sync dialect accepts but the asyncpg
        # driver name lookup does not -- normalize to "postgresql://" first.
        return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    return database_url


def create_engine_from_settings(settings: Settings) -> AsyncEngine:
    async_url = _to_async_url(settings.database_url)

    # SQLite is single-writer: concurrent batches (jobs/scheduler.py's
    # CONCURRENCY_WINDOW) writing through independent pooled connections
    # can hit "database is locked" even for a file-backed DB, since each
    # connection is a separate SQLite handle. StaticPool forces every
    # session in this process onto ONE connection, serializing writes at
    # the connection level -- correct for SQLite (and required for
    # :memory: to be shared across sessions at all), but would need
    # revisiting if this ever moves to Postgres (StaticPool should not be
    # used there; a real connection pool is the right choice for a
    # server that handles genuine concurrent writers).
    if "sqlite" in async_url:
        return create_async_engine(
            async_url, echo=False, poolclass=StaticPool, connect_args={"check_same_thread": False}
        )

    if "postgresql" in async_url:
        # Supabase's connection pooler (PgBouncer, transaction mode) does
        # not support asyncpg's server-side prepared-statement cache --
        # asyncpg raises "prepared statement already exists" under
        # concurrent use unless statement caching is disabled. Harmless
        # against a direct (non-pooled) Postgres connection too, so this
        # is safe regardless of which Supabase connection string is used.
        return create_async_engine(async_url, echo=False, connect_args={"statement_cache_size": 0})

    return create_async_engine(async_url, echo=False)


_TIMESTAMPTZ_COLUMNS = [
    ("job", "created_at"),
    ("job", "completed_at"),
    ("batch", "started_at"),
    ("batch", "completed_at"),
]


async def init_db(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

        # `create_all` never alters an existing table's column types, so a
        # table created before models.py declared these columns TIMESTAMPTZ
        # (sa.DateTime(timezone=True)) is stuck on Postgres's default
        # TIMESTAMP WITHOUT TIME ZONE -- asyncpg then rejects every write of
        # the tz-aware datetime.now(timezone.utc) values repository.py
        # produces ("can't subtract offset-naive and offset-aware
        # datetimes"), silently killing every job at its first INSERT.
        # ALTER COLUMN ... TYPE is idempotent (a no-op once already
        # TIMESTAMPTZ) and only applies to postgresql, so this is safe to
        # run on every startup and a no-op against SQLite.
        if conn.dialect.name == "postgresql":
            for table, column in _TIMESTAMPTZ_COLUMNS:
                await conn.exec_driver_sql(
                    f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE TIMESTAMPTZ USING "{column}" AT TIME ZONE \'UTC\''
                )


@asynccontextmanager
async def get_session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with SQLModelAsyncSession(engine) as session:
        yield session
