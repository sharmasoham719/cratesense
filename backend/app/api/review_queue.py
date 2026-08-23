"""
GET /review-queue -- cross-job triage queue of every flagged (non-green)
field across all jobs, per knowledge-base/LAYOUT.md §3 ('Table, grouped/
sortable by job and marker -- this is a worklist') and journey J3
('all 🔴/🟡 fields'). A worklist entry is one field, not one row -- a row
with two amber attributes appears twice, once per field, since each is a
distinct thing to review.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import select

from app.api.auth import require_auth
from app.db.models import FieldResult, FieldType, Job, Marker, Row
from app.db.session import get_session
from app.deps import AppResources, get_app_resources

router = APIRouter(prefix="/review-queue", tags=["review-queue"], dependencies=[Depends(require_auth)])


class ReviewQueueEntry(BaseModel):
    job_id: str
    row_id: str
    field_type: FieldType
    field_name: str
    value: str
    marker: Marker


@router.get("", response_model=list[ReviewQueueEntry])
async def get_review_queue(resources: AppResources = Depends(get_app_resources)) -> list[ReviewQueueEntry]:
    async with get_session(resources.db_engine) as session:
        # Only jobs that have finished producing markers are worth
        # triaging -- a running job's not-yet-scored fields aren't
        # genuine review items yet.
        completed_job_ids = set(
            (await session.exec(select(Job.id).where(Job.status == "completed"))).all()
        )
        if not completed_job_ids:
            return []

        rows = (await session.exec(select(Row).where(Row.job_id.in_(completed_job_ids)))).all()
        rows_by_pk = {r.id: r for r in rows}
        if not rows:
            return []

        flagged = (
            await session.exec(
                select(FieldResult).where(
                    FieldResult.row_pk.in_(rows_by_pk.keys()),
                    FieldResult.marker.in_([Marker.amber, Marker.red]),
                )
            )
        ).all()

    entries = [
        ReviewQueueEntry(
            job_id=rows_by_pk[f.row_pk].job_id,
            row_id=rows_by_pk[f.row_pk].row_id,
            field_type=f.field_type,
            field_name=f.name,
            value=f.value,
            marker=f.marker,
        )
        for f in flagged
    ]
    # Worst-first: red before amber, consistent with the review table's
    # "spot the red ones fast" priority (knowledge-base/LAYOUT.md §4).
    entries.sort(key=lambda e: 0 if e.marker == Marker.red else 1)
    return entries
