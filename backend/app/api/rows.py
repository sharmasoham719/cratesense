"""
GET /rows, GET /rows/{id} -- browse the real 1,000-row Sample Dataset
Input, per knowledge-base/APPLICATION_ARCHITECTURE.md §3 and
knowledge-base/USER_JOURNEYS.md J1/J6/J7. MUST read from the full CSV
(app.master_data.sample_dataset), not fixture/hand-typed data -- see the
gap logged in development-progress/TASK_LIST.md Goal 4, resolved here.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.auth import require_auth
from app.deps import AppResources, get_app_resources
from app.master_data.sample_dataset import find_row_by_mfg_part_num, load_sample_dataset

router = APIRouter(prefix="/rows", tags=["rows"], dependencies=[Depends(require_auth)])


class RowSummary(BaseModel):
    mfg_part_num: str
    part_desc: str
    e1_brand: str | None
    unilog_brand: str | None
    dib_brand: str | None
    part_manuf: str | None


class RowListResponse(BaseModel):
    rows: list[RowSummary]
    total: int
    limit: int
    offset: int


def _to_row_summary(raw: dict) -> RowSummary:
    return RowSummary(
        mfg_part_num=raw["Mfg_Part_Num"],
        part_desc=raw["Part_Desc"],
        e1_brand=raw.get("E1_Brand") or None,
        unilog_brand=raw.get("Unilog_Brand") or None,
        dib_brand=raw.get("DIB_Brand") or None,
        part_manuf=raw.get("Part_Manuf") or None,
    )


@router.get("", response_model=RowListResponse)
def list_rows(
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, description="Case-insensitive substring match on Part_Desc"),
    resources: AppResources = Depends(get_app_resources),
) -> RowListResponse:
    all_rows = load_sample_dataset(resources.settings.provided_docs_dir)

    if search:
        search_lower = search.lower()
        all_rows = [r for r in all_rows if search_lower in r["Part_Desc"].lower()]

    total = len(all_rows)
    page = all_rows[offset : offset + limit]

    return RowListResponse(
        rows=[_to_row_summary(r) for r in page],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{mfg_part_num}", response_model=RowSummary)
def get_row(mfg_part_num: str, resources: AppResources = Depends(get_app_resources)) -> RowSummary:
    raw = find_row_by_mfg_part_num(resources.settings.provided_docs_dir, mfg_part_num)
    if raw is None:
        raise HTTPException(status_code=404, detail=f"Row not found: {mfg_part_num}")
    return _to_row_summary(raw)
