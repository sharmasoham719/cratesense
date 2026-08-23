"""
Per-job SSE event bus, per knowledge-base/APPLICATION_ARCHITECTURE.md §3
event shape: batch_started, node_transition, row_completed,
batch_completed, job_completed, job_failed.

Each job gets its own asyncio.Queue; GET /jobs/{id}/stream (Goal 9)
subscribes by reading from that queue. Kept in-process/in-memory --
matches the "lightweight DB (jobs/rows persisted), in-memory event
delivery" split implied by APPLICATION_ARCHITECTURE.md §4 (SSE push is
transient, not something that needs replay after a dropped connection
within this hackathon's scope).
"""

import asyncio
from dataclasses import dataclass, field
from typing import Any


@dataclass
class JobEvent:
    event: str
    batch_id: str | None = None
    row_id: str | None = None
    node: str | None = None
    status: str | None = None
    marker: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = {"event": self.event}
        for key in ("batch_id", "row_id", "node", "status", "marker"):
            value = getattr(self, key)
            if value is not None:
                d[key] = value
        d.update(self.extra)
        return d


class JobEventBus:
    """One queue per job_id. Not persisted -- a dropped SSE connection
    misses events emitted while disconnected (acceptable for this scope,
    per knowledge-base/APPLICATION_ARCHITECTURE.md's job/row state living
    in the DB; live progress is a nice-to-have replay, not the source of
    truth)."""

    def __init__(self):
        self._queues: dict[str, asyncio.Queue[JobEvent]] = {}

    def _get_or_create_queue(self, job_id: str) -> asyncio.Queue:
        if job_id not in self._queues:
            self._queues[job_id] = asyncio.Queue()
        return self._queues[job_id]

    def publish(self, job_id: str, event: JobEvent) -> None:
        queue = self._get_or_create_queue(job_id)
        queue.put_nowait(event)

    async def subscribe(self, job_id: str):
        """Async generator yielding JobEvents for this job as they're
        published. Caller (an SSE endpoint) breaks out of the loop after
        a job_completed/job_failed event."""
        queue = self._get_or_create_queue(job_id)
        while True:
            event = await queue.get()
            yield event
            if event.event in ("job_completed", "job_failed"):
                break

    def cleanup(self, job_id: str) -> None:
        self._queues.pop(job_id, None)


job_event_bus = JobEventBus()
