"""
SQLModel persistence schema: Job -> Batch -> Row -> FieldResult, plus Flag.
Maps onto the pipeline's in-memory BatchState/RowState
(app.pipeline.state) -- this is where that state lands once a job/batch/
row finishes, per knowledge-base/APPLICATION_ARCHITECTURE.md §3's job/row
DB requirement.

FieldResult covers BOTH attributes and descriptions (discriminated by
`field_type`) rather than two separate tables, since both share the same
shape: a named field with a value/text, confidence, and marker.
"""

from datetime import datetime
from enum import Enum

import sqlalchemy as sa
from sqlmodel import Field, SQLModel

# repository.py writes datetime.now(timezone.utc) (tz-aware) everywhere.
# SQLModel's bare `datetime` maps to Postgres's TIMESTAMP WITHOUT TIME ZONE
# by default -- asyncpg rejects a tz-aware value against that column type
# ("can't subtract offset-naive and offset-aware datetimes"), which SQLite
# never caught locally since it stores datetimes as permissive ISO strings.
# TIMESTAMPTZ accepts the tz-aware values the app already produces.
_TZ_DATETIME = sa.DateTime(timezone=True)


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class BatchStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class FieldType(str, Enum):
    attribute = "attribute"
    description = "description"


class Marker(str, Enum):
    green = "green"
    amber = "amber"
    red = "red"


class Job(SQLModel, table=True):
    id: str = Field(primary_key=True)
    status: JobStatus = Field(default=JobStatus.pending)
    row_count: int
    batch_size: int
    concurrency_window: int
    created_at: datetime = Field(sa_column=sa.Column(_TZ_DATETIME))
    completed_at: datetime | None = Field(default=None, sa_column=sa.Column(_TZ_DATETIME))
    error: str | None = None


class Batch(SQLModel, table=True):
    id: str = Field(primary_key=True)
    job_id: str = Field(foreign_key="job.id", index=True)
    status: BatchStatus = Field(default=BatchStatus.pending)
    row_count: int
    started_at: datetime | None = Field(default=None, sa_column=sa.Column(_TZ_DATETIME))
    completed_at: datetime | None = Field(default=None, sa_column=sa.Column(_TZ_DATETIME))
    error: str | None = None


class Row(SQLModel, table=True):
    """Primary key is (job_id, row_id) conceptually -- `id` is a synthetic
    surrogate key (f"{job_id}:{row_id}") so it stays a plain string PK
    without needing a composite key, while row_id (Mfg_Part_Num) stays
    queryable on its own for cross-job lookups."""

    id: str = Field(primary_key=True)
    job_id: str = Field(foreign_key="job.id", index=True)
    batch_id: str = Field(foreign_key="batch.id", index=True)
    row_id: str = Field(index=True)  # Mfg_Part_Num

    part_desc: str
    e1_brand: str | None = None
    unilog_brand: str | None = None
    dib_brand: str | None = None
    part_manuf: str | None = None

    classpath: str | None = None
    manufacturer_name: str | None = None
    brand_name: str | None = None

    attribute_retry_count: int = 0
    description_retry_count: int = 0


class FieldResult(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    row_pk: str = Field(foreign_key="row.id", index=True)
    field_type: FieldType
    name: str  # attribute label, or description format name (invoice_desc, etc.)
    value: str  # attribute value, or description text
    uom: str | None = None  # attributes only
    confidence: float | None = None
    marker: Marker | None = None
    rule_checks_json: str | None = None  # JSON-encoded list[{rule, passed, detail}], per FieldRuleTrace


class Flag(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    row_pk: str = Field(foreign_key="row.id", index=True)
    text: str  # e.g. "attribute_not_in_lov:Mounting Type=Freestanding"
