"""
POST /jobs, GET /jobs, GET /jobs/{id}, GET /jobs/{id}/rows/{row_id},
GET /jobs/{id}/export -- per knowledge-base/APPLICATION_ARCHITECTURE.md
§3. Job creation kicks off jobs.scheduler.run_job as a background
asyncio task (fire-and-forget); progress is observable via
GET /jobs/{id}/stream (api/stream.py) or by polling GET /jobs/{id}.
"""

import asyncio
import csv
import io
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import select

from app.api.auth import require_auth
from app.db.models import FieldResult, FieldType, Flag, Job, JobStatus, Marker, Row
from app.db.session import get_session
from app.deps import AppResources, get_app_resources
from app.jobs.scheduler import run_job
from app.master_data.sample_dataset import load_sample_dataset
from app.pipeline.nodes.record_assembler import AssembledAttribute, AssembledDescription, AssembledRecord
from app.pipeline.state import RuleCheckState


def _parse_rule_checks(rule_checks_json: str | None) -> list[RuleCheckState]:
    if not rule_checks_json:
        return []
    return [RuleCheckState(**c) for c in json.loads(rule_checks_json)]


_MARKER_RANK = {Marker.red: 0, Marker.amber: 1, Marker.green: 2}


def _overall_marker(markers: list[Marker]) -> Marker:
    """Worst marker across a row's fields -- mirrors the frontend's
    overallMarker (app/jobs/[id]/review-columns.tsx), so job history's
    marker distribution and the review table's per-row status agree.
    A row with no marked fields yet counts as red (nothing to show is
    the least trustworthy state, not the most)."""
    if not markers:
        return Marker.red
    return min(markers, key=lambda m: _MARKER_RANK[m])

router = APIRouter(prefix="/jobs", tags=["jobs"], dependencies=[Depends(require_auth)])


class CreateJobRequest(BaseModel):
    mfg_part_nums: list[str]


class MarkerDistribution(BaseModel):
    green: int
    amber: int
    red: int


class JobSummary(BaseModel):
    id: str
    status: JobStatus
    row_count: int
    created_at: datetime
    marker_distribution: MarkerDistribution | None = None


class JobDetail(BaseModel):
    id: str
    status: JobStatus
    row_count: int
    batch_size: int
    concurrency_window: int


@router.post("", response_model=JobSummary, status_code=201)
async def create_job(
    request: Request, body: CreateJobRequest, resources: AppResources = Depends(get_app_resources)
) -> JobSummary:
    if not body.mfg_part_nums:
        raise HTTPException(status_code=400, detail="mfg_part_nums must be non-empty")

    all_rows = {r["Mfg_Part_Num"]: r for r in load_sample_dataset(resources.settings.provided_docs_dir)}
    missing = [m for m in body.mfg_part_nums if m not in all_rows]
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown Mfg_Part_Num(s): {missing}")

    raw_rows = [all_rows[m] for m in body.mfg_part_nums]
    job_id = str(uuid.uuid4())

    # Fire-and-forget: run_job persists job/batch/row state itself
    # (db/repository.py), so the response doesn't need to wait for
    # completion -- clients poll GET /jobs/{id} or subscribe to
    # GET /jobs/{id}/stream. Registered on app.state.background_tasks so
    # the lifespan shutdown handler (app/main.py) can await in-flight
    # jobs before disposing the DB engine -- otherwise a still-running
    # job can write through a disposed connection during fast app
    # startup/shutdown cycles (e.g. back-to-back test runs).
    task = asyncio.create_task(
        run_job(
            job_id,
            raw_rows,
            resources.provider,
            resources.lov_index,
            resources.manufacturer_index,
            resources.uom_index,
            resources.settings,
            resources.db_engine,
        )
    )
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)

    return JobSummary(
        id=job_id, status=JobStatus.pending, row_count=len(raw_rows), created_at=datetime.now(timezone.utc)
    )


async def _marker_distributions_by_job(resources: AppResources, job_ids: list[str]) -> dict[str, MarkerDistribution]:
    """Overall-marker distribution per job, per knowledge-base/LAYOUT.md §3
    ('marker distribution (small inline stacked bar)'). A row's overall
    marker is the worst marker across its fields (mirrors the frontend's
    overallMarker) -- computed here rather than per-field, so the job
    history bar and the review table's per-row status always agree."""
    if not job_ids:
        return {}

    async with get_session(resources.db_engine) as session:
        rows = (await session.exec(select(Row).where(Row.job_id.in_(job_ids)))).all()
        rows_by_id = {r.id: r for r in rows}
        if not rows:
            return {}
        field_results = (
            await session.exec(select(FieldResult).where(FieldResult.row_pk.in_(rows_by_id.keys())))
        ).all()

    markers_by_row_pk: dict[str, list[Marker]] = {row_pk: [] for row_pk in rows_by_id}
    for f in field_results:
        if f.marker is not None:
            markers_by_row_pk[f.row_pk].append(f.marker)

    distributions: dict[str, MarkerDistribution] = {
        job_id: MarkerDistribution(green=0, amber=0, red=0) for job_id in job_ids
    }
    for row_pk, row in rows_by_id.items():
        overall = _overall_marker(markers_by_row_pk[row_pk])
        dist = distributions[row.job_id]
        setattr(dist, overall.value, getattr(dist, overall.value) + 1)

    return distributions


@router.get("", response_model=list[JobSummary])
async def list_jobs(resources: AppResources = Depends(get_app_resources)) -> list[JobSummary]:
    async with get_session(resources.db_engine) as session:
        result = await session.exec(select(Job).order_by(Job.created_at.desc()))
        jobs = result.all()

    distributions = await _marker_distributions_by_job(resources, [j.id for j in jobs])
    return [
        JobSummary(
            id=j.id,
            status=j.status,
            row_count=j.row_count,
            created_at=j.created_at,
            marker_distribution=distributions.get(j.id),
        )
        for j in jobs
    ]


@router.get("/{job_id}", response_model=JobDetail)
async def get_job(job_id: str, resources: AppResources = Depends(get_app_resources)) -> JobDetail:
    async with get_session(resources.db_engine) as session:
        job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return JobDetail(
        id=job.id,
        status=job.status,
        row_count=job.row_count,
        batch_size=job.batch_size,
        concurrency_window=job.concurrency_window,
    )


async def _load_assembled_record(resources: AppResources, job_id: str, row_id: str) -> AssembledRecord | None:
    row_pk = f"{job_id}:{row_id}"
    async with get_session(resources.db_engine) as session:
        row = await session.get(Row, row_pk)
        if row is None:
            return None

        field_results = (await session.exec(select(FieldResult).where(FieldResult.row_pk == row_pk))).all()
        flags = (await session.exec(select(Flag).where(Flag.row_pk == row_pk))).all()

    attributes = [
        AssembledAttribute(
            label=f.name,
            value=f.value,
            uom=f.uom,
            marker=f.marker.value if f.marker else None,
            rule_checks=_parse_rule_checks(f.rule_checks_json),
        )
        for f in field_results
        if f.field_type == FieldType.attribute
    ]
    descriptions = {
        f.name: AssembledDescription(
            text=f.value,
            char_count=len(f.value),
            marker=f.marker.value if f.marker else None,
            rule_checks=_parse_rule_checks(f.rule_checks_json),
        )
        for f in field_results
        if f.field_type == FieldType.description
    }

    return AssembledRecord(
        mfg_part_num=row.row_id,
        part_desc=row.part_desc,
        e1_brand=row.e1_brand,
        unilog_brand=row.unilog_brand,
        dib_brand=row.dib_brand,
        part_manuf=row.part_manuf,
        classpath=row.classpath,
        manufacturer_name=row.manufacturer_name,
        brand_name=row.brand_name,
        descriptions=descriptions,
        attributes=attributes,
        flags=[f.text for f in flags],
    )


@router.get("/{job_id}/rows", response_model=list[AssembledRecord])
async def list_job_rows(job_id: str, resources: AppResources = Depends(get_app_resources)) -> list[AssembledRecord]:
    """Backs the review-mode results table (Goal 14,
    knowledge-base/LAYOUT.md §3 'Job detail -- review view'): every
    assembled record for a completed (or in-progress) job, for the
    reviewer to scan for red/amber flags across the whole run."""
    async with get_session(resources.db_engine) as session:
        job = await session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
        rows = (await session.exec(select(Row).where(Row.job_id == job_id))).all()

    records = []
    for row in rows:
        record = await _load_assembled_record(resources, job_id, row.row_id)
        if record is not None:
            records.append(record)
    return records


@router.get("/{job_id}/rows/{row_id}", response_model=AssembledRecord)
async def get_job_row(
    job_id: str, row_id: str, resources: AppResources = Depends(get_app_resources)
) -> AssembledRecord:
    record = await _load_assembled_record(resources, job_id, row_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Row not found in job: {row_id}")
    return record


@router.get("/{job_id}/export")
async def export_job(job_id: str, resources: AppResources = Depends(get_app_resources)) -> StreamingResponse:
    async with get_session(resources.db_engine) as session:
        job = await session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
        rows = (await session.exec(select(Row).where(Row.job_id == job_id))).all()

    records = []
    for row in rows:
        record = await _load_assembled_record(resources, job_id, row.row_id)
        if record is not None:
            records.append(record.to_delivery_format_dict())

    output = io.StringIO()
    if records:
        all_columns: list[str] = []
        for r in records:
            for col in r.keys():
                if col not in all_columns:
                    all_columns.append(col)
        writer = csv.DictWriter(output, fieldnames=all_columns)
        writer.writeheader()
        writer.writerows(records)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{job_id}_export.csv"'},
    )
