"""
Persists pipeline results (app.pipeline.state.BatchState/RowState) into
the DB tables defined in db/models.py. Called by jobs/worker.py and
jobs/scheduler.py -- keeps SQL/ORM concerns out of the pipeline and job-
orchestration layers, which stay storage-agnostic.

Every write function acquires session.get_write_lock(engine) --
required because SQLite has no real concurrent-writer support; without
it, concurrent batches (jobs/scheduler.py's CONCURRENCY_WINDOW) writing
through StaticPool's single shared connection can interleave
transactions in ways a reader observes as out-of-order (a job's status
flipping to "completed" while a sibling batch's rows are still being
written) -- caught via a flaky test under concurrent batches, not a
theoretical concern.
"""

import json
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncEngine

from app.db.models import Batch, BatchStatus, FieldResult, FieldType, Flag, Job, JobStatus, Row
from app.db.session import get_session, get_write_lock
from app.pipeline.state import BatchState


def _now() -> datetime:
    # Settings/pipeline modules forbid datetime.now()-at-import-time patterns
    # used by Workflow scripts, but this is plain application code (not a
    # Workflow script), so a straightforward call is fine here.
    return datetime.now(timezone.utc)


async def create_job(engine: AsyncEngine, job_id: str, row_count: int, batch_size: int, concurrency_window: int) -> None:
    async with get_write_lock(engine):
        async with get_session(engine) as session:
            session.add(
                Job(
                    id=job_id,
                    status=JobStatus.running,
                    row_count=row_count,
                    batch_size=batch_size,
                    concurrency_window=concurrency_window,
                    created_at=_now(),
                )
            )
            await session.commit()


async def mark_job_completed(engine: AsyncEngine, job_id: str) -> None:
    async with get_write_lock(engine):
        async with get_session(engine) as session:
            job = await session.get(Job, job_id)
            if job is not None:
                job.status = JobStatus.completed
                job.completed_at = _now()
                session.add(job)
                await session.commit()


async def mark_job_failed(engine: AsyncEngine, job_id: str, error: str) -> None:
    async with get_write_lock(engine):
        async with get_session(engine) as session:
            job = await session.get(Job, job_id)
            if job is not None:
                job.status = JobStatus.failed
                job.completed_at = _now()
                job.error = error
                session.add(job)
                await session.commit()


async def create_batch(engine: AsyncEngine, batch_id: str, job_id: str, row_count: int) -> None:
    async with get_write_lock(engine):
        async with get_session(engine) as session:
            session.add(
                Batch(id=batch_id, job_id=job_id, status=BatchStatus.running, row_count=row_count, started_at=_now())
            )
            await session.commit()


async def save_batch_result(engine: AsyncEngine, job_id: str, batch_id: str, batch_state: BatchState) -> None:
    """Persists a completed batch's rows, attributes, descriptions, and
    flags in one transaction."""
    async with get_write_lock(engine):
        async with get_session(engine) as session:
            batch = await session.get(Batch, batch_id)
            if batch is not None:
                batch.status = BatchStatus.completed
                batch.completed_at = _now()
                session.add(batch)

            for row_state in batch_state.rows:
                row_pk = f"{job_id}:{row_state.row_id}"
                row = Row(
                    id=row_pk,
                    job_id=job_id,
                    batch_id=batch_id,
                    row_id=row_state.row_id,
                    part_desc=row_state.raw_row.part_desc,
                    e1_brand=row_state.raw_row.e1_brand,
                    unilog_brand=row_state.raw_row.unilog_brand,
                    dib_brand=row_state.raw_row.dib_brand,
                    part_manuf=row_state.raw_row.part_manuf,
                    classpath=row_state.classpath,
                    manufacturer_name=row_state.manufacturer_name,
                    brand_name=row_state.brand_name,
                    attribute_retry_count=row_state.retry_counts.get("attribute", 0),
                    description_retry_count=row_state.retry_counts.get("description", 0),
                )
                session.add(row)
                # Postgres/asyncpg's insertmany fast-path can batch this
                # flush's Row and FieldResult/Flag INSERTs in a way that
                # violates fieldresult_row_pk_fkey (the child row lands
                # before its parent commits) -- SQLite never hit this since
                # StaticPool serializes everything onto one connection.
                # Flushing the Row insert on its own, before any child rows
                # for it are added, forces the correct order.
                await session.flush()

                for attr in row_state.attributes:
                    session.add(
                        FieldResult(
                            row_pk=row_pk,
                            field_type=FieldType.attribute,
                            name=attr.label,
                            value=attr.value,
                            uom=attr.uom,
                            confidence=attr.confidence,
                            marker=attr.marker,
                            rule_checks_json=json.dumps([c.model_dump() for c in attr.rule_checks]),
                        )
                    )

                for format_name, desc in row_state.descriptions.items():
                    session.add(
                        FieldResult(
                            row_pk=row_pk,
                            field_type=FieldType.description,
                            name=format_name,
                            value=desc.text,
                            confidence=desc.confidence,
                            marker=desc.marker,
                            rule_checks_json=json.dumps([c.model_dump() for c in desc.rule_checks]),
                        )
                    )

                for flag_text in row_state.flags:
                    session.add(Flag(row_pk=row_pk, text=flag_text))

            await session.commit()


async def mark_batch_failed(engine: AsyncEngine, batch_id: str, error: str) -> None:
    async with get_write_lock(engine):
        async with get_session(engine) as session:
            batch = await session.get(Batch, batch_id)
            if batch is not None:
                batch.status = BatchStatus.failed
                batch.completed_at = _now()
                batch.error = error
                session.add(batch)
                await session.commit()
