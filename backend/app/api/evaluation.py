"""
GET /evaluation/{job_id} -- per knowledge-base/APPLICATION_ARCHITECTURE.md
§3. Runs evaluation.scorer.evaluate_job against the persisted job data.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.auth import require_auth
from app.deps import AppResources, get_app_resources
from app.evaluation.scorer import evaluate_job

router = APIRouter(prefix="/evaluation", tags=["evaluation"], dependencies=[Depends(require_auth)])


class FieldAccuracyDetailResponse(BaseModel):
    row_id: str
    field_name: str
    expected: str
    actual: str | None
    matched: bool


class EvaluationResponse(BaseModel):
    job_id: str
    scored_row_count: int
    total_row_count: int
    field_level_accuracy: float | None
    char_limit_compliance: float | None
    lov_compliance: float | None
    field_accuracy_details: list[FieldAccuracyDetailResponse]
    unscored_row_ids: list[str]


@router.get("/{job_id}", response_model=EvaluationResponse)
async def get_evaluation(job_id: str, resources: AppResources = Depends(get_app_resources)) -> EvaluationResponse:
    try:
        result = await evaluate_job(resources.db_engine, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return EvaluationResponse(
        job_id=result.job_id,
        scored_row_count=result.scored_row_count,
        total_row_count=result.total_row_count,
        field_level_accuracy=result.field_level_accuracy,
        char_limit_compliance=result.char_limit_compliance,
        lov_compliance=result.lov_compliance,
        field_accuracy_details=[
            FieldAccuracyDetailResponse(
                row_id=d.row_id, field_name=d.field_name, expected=d.expected, actual=d.actual, matched=d.matched
            )
            for d in result.field_accuracy_details
        ],
        unscored_row_ids=result.unscored_row_ids,
    )
