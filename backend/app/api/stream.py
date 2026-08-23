"""
GET /jobs/{id}/stream -- SSE endpoint, per
knowledge-base/APPLICATION_ARCHITECTURE.md §3. Subscribes to
jobs.events.job_event_bus and forwards each JobEvent as an SSE `data:`
line until a terminal event (job_completed/job_failed) closes the stream.
"""

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.auth import require_auth
from app.jobs.events import job_event_bus

router = APIRouter(prefix="/jobs", tags=["stream"], dependencies=[Depends(require_auth)])


async def _sse_event_generator(job_id: str):
    async for event in job_event_bus.subscribe(job_id):
        payload = json.dumps(event.to_dict())
        yield f"data: {payload}\n\n"


@router.get("/{job_id}/stream")
async def stream_job(job_id: str) -> StreamingResponse:
    return StreamingResponse(
        _sse_event_generator(job_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
