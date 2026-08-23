"""
DescriptionBuilder: LLM node. One call per batch/sub-batch generates the
5 description formats using the row's validated attribute set + brand,
per knowledge-base/BACKEND_COGNITIVE_FLOW.md §4 and the construction
formula in knowledge-base/HACKATHON_STATEMENT.md §4.1/§4.2:
"Product Title = Brand + Series + MPN + Item Type + key attributes".

Only processes rows in `target_row_ids` (all rows on first entry, the
retry sub-batch on re-entry -- see description_auditor.py), mirroring
attribute_extractor.py's partial-retry pattern.
"""

from app.llm.base import BaseLLMProvider
from app.pipeline.schemas import DescriptionGenerationResult
from app.pipeline.state import BatchState, DescriptionState, RowState

_DESCRIPTION_FIELDS = [
    "invoice_desc",
    "mobile_desc",
    "short_desc",
    "long_desc",
    "retail_desc",
    "marketing_description",
]


def _build_prompt(row: RowState) -> str:
    attrs_text = "; ".join(f"{a.label} = {a.value}{f' {a.uom}' if a.uom else ''}" for a in row.attributes)
    return (
        f"row_id: {row.row_id}\n"
        f"Generate 5 product descriptions (invoice <=40 char CAPS, mobile 60-80 char, "
        f"short/title, long, retail, marketing) following: "
        f"Product Title = Brand + Series + MPN + Item Type + key attributes.\n"
        f"Brand: {row.brand_name or 'unknown'}\n"
        f"MPN: {row.row_id}\n"
        f"Classpath: {row.classpath or 'unknown'}\n"
        f"Attributes: {attrs_text or '(none extracted)'}"
    )


async def build_descriptions(
    batch: BatchState,
    provider: BaseLLMProvider,
    target_row_ids: list[str] | None = None,
) -> BatchState:
    targets = {row.row_id for row in batch.rows} if target_row_ids is None else set(target_row_ids)
    rows_to_process = [row for row in batch.rows if row.row_id in targets]
    if not rows_to_process:
        return batch

    prompts = [_build_prompt(row) for row in rows_to_process]
    results = await provider.generate_structured_batch(prompts, DescriptionGenerationResult)
    results_by_row_id = {r.row_id: r for r in results}

    for row in rows_to_process:
        result = results_by_row_id.get(row.row_id)
        if result is None:
            continue
        for field_name in _DESCRIPTION_FIELDS:
            text = getattr(result.descriptions, field_name)
            row.descriptions[field_name] = DescriptionState(text=text, char_count=len(text))

    return batch
