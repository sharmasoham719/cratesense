"""
Evaluation scoring, per knowledge-base/HACKATHON_STATEMENT.md §3:
1. Field-level accuracy against ground truth.
2. Character-limit compliance across the description formats.
3. % of generated attribute values found in the LOV (zero hallucinated
   vocabulary).

Reads persisted job/row/field data (db/models.py) for a completed job,
scores only rows that have ground truth (evaluation/ground_truth.py) --
per the honest scope note there, this may be a small subset of the job's
rows if the real 200-item ground truth was never obtained.
"""

from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import select

from app.db.models import FieldResult, FieldType, Flag, Job, Row
from app.db.session import get_session
from app.evaluation.ground_truth import GroundTruthRow, get_ground_truth, has_ground_truth
from app.pipeline.rules.char_limits import check_char_limit


@dataclass
class FieldAccuracyDetail:
    row_id: str
    field_name: str
    expected: str
    actual: str | None
    matched: bool


@dataclass
class EvaluationResult:
    job_id: str
    scored_row_count: int
    total_row_count: int
    field_level_accuracy: float | None  # None if no rows had ground truth
    char_limit_compliance: float | None
    lov_compliance: float | None
    field_accuracy_details: list[FieldAccuracyDetail] = field(default_factory=list)
    unscored_row_ids: list[str] = field(default_factory=list)  # rows with no ground truth to compare against


def _normalize(value: str) -> str:
    return value.strip().lower()


def _score_row_field_accuracy(row: Row, field_results: list[FieldResult], gt: GroundTruthRow) -> list[FieldAccuracyDetail]:
    details = []

    details.append(
        FieldAccuracyDetail(
            row.row_id, "classpath", gt.classpath, row.classpath,
            row.classpath is not None and _normalize(row.classpath) == _normalize(gt.classpath),
        )
    )
    details.append(
        FieldAccuracyDetail(
            row.row_id, "manufacturer_name", gt.manufacturer_name, row.manufacturer_name,
            row.manufacturer_name is not None and _normalize(row.manufacturer_name) == _normalize(gt.manufacturer_name),
        )
    )
    details.append(
        FieldAccuracyDetail(
            row.row_id, "brand_name", gt.brand_name, row.brand_name,
            row.brand_name is not None and _normalize(row.brand_name) == _normalize(gt.brand_name),
        )
    )

    invoice_result = next((f for f in field_results if f.field_type == FieldType.description and f.name == "invoice_desc"), None)
    details.append(
        FieldAccuracyDetail(
            row.row_id, "invoice_desc", gt.invoice_desc,
            invoice_result.value if invoice_result else None,
            invoice_result is not None and _normalize(invoice_result.value) == _normalize(gt.invoice_desc),
        )
    )

    for gt_attr in gt.attributes:
        actual = next(
            (f for f in field_results if f.field_type == FieldType.attribute and f.name == gt_attr.label), None
        )
        matched = actual is not None and _normalize(actual.value) == _normalize(gt_attr.value)
        details.append(
            FieldAccuracyDetail(
                row.row_id, f"attribute:{gt_attr.label}", gt_attr.value,
                actual.value if actual else None, matched,
            )
        )

    return details


def _score_char_limit_compliance(field_results: list[FieldResult]) -> tuple[int, int]:
    """Returns (compliant_count, total_count) across all description fields."""
    descriptions = [f for f in field_results if f.field_type == FieldType.description]
    compliant = sum(1 for f in descriptions if check_char_limit(f.name, f.value).passed)
    return compliant, len(descriptions)


def _score_lov_compliance(field_results: list[FieldResult], flags: list[str]) -> tuple[int, int]:
    """% of attribute values found in the LOV = 1 - (flagged / total attributes)."""
    attributes = [f for f in field_results if f.field_type == FieldType.attribute]
    flagged_labels = {f.split(":", 1)[1].split("=")[0] for f in flags if f.startswith("attribute_not_in_lov:")}
    compliant = sum(1 for a in attributes if a.name not in flagged_labels)
    return compliant, len(attributes)


async def evaluate_job(engine: AsyncEngine, job_id: str) -> EvaluationResult:
    async with get_session(engine) as session:
        job = await session.get(Job, job_id)
        if job is None:
            raise ValueError(f"Job not found: {job_id}")

        rows = (await session.exec(select(Row).where(Row.job_id == job_id))).all()

        all_field_results: dict[str, list[FieldResult]] = {}
        all_flags: dict[str, list[str]] = {}
        for row in rows:
            field_results = (await session.exec(select(FieldResult).where(FieldResult.row_pk == row.id))).all()
            all_field_results[row.id] = list(field_results)

            flags = (await session.exec(select(Flag).where(Flag.row_pk == row.id))).all()
            all_flags[row.id] = [f.text for f in flags]

    field_accuracy_details: list[FieldAccuracyDetail] = []
    unscored_row_ids: list[str] = []
    total_char_compliant = total_char_checked = 0
    total_lov_compliant = total_lov_checked = 0

    for row in rows:
        field_results = all_field_results[row.id]
        flags = all_flags[row.id]

        char_compliant, char_checked = _score_char_limit_compliance(field_results)
        total_char_compliant += char_compliant
        total_char_checked += char_checked

        lov_compliant, lov_checked = _score_lov_compliance(field_results, flags)
        total_lov_compliant += lov_compliant
        total_lov_checked += lov_checked

        gt = get_ground_truth(row.row_id)
        if gt is None:
            unscored_row_ids.append(row.row_id)
            continue
        field_accuracy_details.extend(_score_row_field_accuracy(row, field_results, gt))

    field_level_accuracy = None
    if field_accuracy_details:
        matched = sum(1 for d in field_accuracy_details if d.matched)
        field_level_accuracy = matched / len(field_accuracy_details)

    char_limit_compliance = total_char_compliant / total_char_checked if total_char_checked else None
    lov_compliance = total_lov_compliant / total_lov_checked if total_lov_checked else None

    return EvaluationResult(
        job_id=job_id,
        scored_row_count=len(rows) - len(unscored_row_ids),
        total_row_count=len(rows),
        field_level_accuracy=field_level_accuracy,
        char_limit_compliance=char_limit_compliance,
        lov_compliance=lov_compliance,
        field_accuracy_details=field_accuracy_details,
        unscored_row_ids=unscored_row_ids,
    )
