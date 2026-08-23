"""
Chunks a job's rows into BATCH_SIZE batches and runs up to
CONCURRENCY_WINDOW of them concurrently, per
knowledge-base/BACKEND_COGNITIVE_FLOW.md §1 and knowledge-base/TECH_STACK.md
§4: "A job of N rows is chunked into ceil(N / BATCH_SIZE) batches; up to
CONCURRENCY_WINDOW batches run their LangGraph invocations concurrently
at any time."

Depends only on jobs.worker.run_batch, which is itself provider-agnostic
-- this layer never branches on MOCK_LLM or any provider detail, so it
behaves identically against the mock provider (today) or a real one
(MOCK_LLM=false, no code changes needed here).
"""

import asyncio
import math

from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import Settings
from app.db import repository
from app.jobs.events import JobEvent, job_event_bus
from app.jobs.worker import run_batch
from app.llm.base import BaseLLMProvider
from app.master_data.lov_index import LovIndex
from app.master_data.manufacturer_index import ManufacturerIndex
from app.master_data.uom_index import UomIndex
from app.pipeline.state import BatchState


def chunk_rows(raw_rows: list[dict], batch_size: int) -> list[list[dict]]:
    """ceil(N / batch_size) chunks, in original row order."""
    if batch_size < 1:
        raise ValueError(f"batch_size must be >= 1, got {batch_size}")
    return [raw_rows[i : i + batch_size] for i in range(0, len(raw_rows), batch_size)]


async def run_job(
    job_id: str,
    raw_rows: list[dict],
    provider: BaseLLMProvider,
    lov_index: LovIndex,
    manufacturer_index: ManufacturerIndex,
    uom_index: UomIndex,
    settings: Settings,
    engine: AsyncEngine,
) -> list[BatchState]:
    """Runs all batches for a job, respecting CONCURRENCY_WINDOW, persists
    job/batch/row state (Goal 8), and returns the list of BatchState
    results in batch order."""
    batches = chunk_rows(raw_rows, settings.batch_size)
    semaphore = asyncio.Semaphore(settings.concurrency_window)

    await repository.create_job(engine, job_id, len(raw_rows), settings.batch_size, settings.concurrency_window)

    async def run_one_batch(index: int, batch_rows: list[dict]) -> BatchState:
        batch_id = f"{job_id}-batch-{index}"
        async with semaphore:
            return await run_batch(
                job_id, batch_id, batch_rows, provider, lov_index, manufacturer_index, uom_index, settings, engine
            )

    try:
        results = await asyncio.gather(*(run_one_batch(i, b) for i, b in enumerate(batches)))
    except Exception as exc:
        await repository.mark_job_failed(engine, job_id, str(exc))
        job_event_bus.publish(job_id, JobEvent(event="job_failed", extra={"error": str(exc)}))
        raise

    await repository.mark_job_completed(engine, job_id)
    job_event_bus.publish(job_id, JobEvent(event="job_completed"))
    return list(results)


def expected_batch_count(row_count: int, batch_size: int) -> int:
    if batch_size < 1:
        raise ValueError(f"batch_size must be >= 1, got {batch_size}")
    return math.ceil(row_count / batch_size)
