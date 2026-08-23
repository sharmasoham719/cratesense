"""
One batch's lifecycle: run the pipeline graph (pipeline.graph.run_pipeline
-- provider-agnostic, works identically under MOCK_LLM=true or a real
provider, per knowledge-base/TECH_STACK.md §3), persist the result (Goal
8's db/repository.py), emit progress events via the job event bus, return
the resulting BatchState.

Emits genuine per-row, per-node SSE events (batch_started, node_transition
per row per graph node, row_completed, batch_completed) using
run_pipeline's on_node_transition callback (Goal 13) -- LangGraph's
astream() surfaces each node's output as it completes, so this needs no
changes to any node function itself. This closes the gap noted when this
file was first written at Goal 7 ("node-by-node progress events aren't
emitted... left as an explicit Goal 9 task").
"""

from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import Settings
from app.db import repository
from app.jobs.events import JobEvent, job_event_bus
from app.llm.base import BaseLLMProvider
from app.master_data.lov_index import LovIndex
from app.master_data.manufacturer_index import ManufacturerIndex
from app.master_data.uom_index import UomIndex
from app.pipeline.graph import run_pipeline
from app.pipeline.state import BatchState


async def run_batch(
    job_id: str,
    batch_id: str,
    raw_rows: list[dict],
    provider: BaseLLMProvider,
    lov_index: LovIndex,
    manufacturer_index: ManufacturerIndex,
    uom_index: UomIndex,
    settings: Settings,
    engine: AsyncEngine,
) -> BatchState:
    job_event_bus.publish(job_id, JobEvent(event="batch_started", batch_id=batch_id))
    await repository.create_batch(engine, batch_id, job_id, row_count=len(raw_rows))

    async def on_node_transition(node_name: str, state: BatchState) -> None:
        for row in state.rows:
            job_event_bus.publish(
                job_id,
                JobEvent(event="node_transition", batch_id=batch_id, row_id=row.row_id, node=node_name, status="completed"),
            )

    try:
        result = await run_pipeline(
            raw_rows, batch_id, provider, lov_index, manufacturer_index, uom_index, settings,
            on_node_transition=on_node_transition,
        )
    except Exception as exc:
        await repository.mark_batch_failed(engine, batch_id, str(exc))
        job_event_bus.publish(
            job_id,
            JobEvent(event="batch_failed", batch_id=batch_id, extra={"error": str(exc)}),
        )
        raise

    await repository.save_batch_result(engine, job_id, batch_id, result)

    for row in result.rows:
        job_event_bus.publish(job_id, JobEvent(event="row_completed", batch_id=batch_id, row_id=row.row_id))

    job_event_bus.publish(job_id, JobEvent(event="batch_completed", batch_id=batch_id))
    return result
