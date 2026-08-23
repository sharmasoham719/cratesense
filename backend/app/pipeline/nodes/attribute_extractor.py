"""
AttributeExtractor: LLM node. One call per batch/sub-batch (per
knowledge-base/BACKEND_COGNITIVE_FLOW.md §1/§4) extracts candidate
label/value/UOM triples for each pending row, RAG-grounded on that row's
classpath's permitted attribute list (LovIndex.attributes_for_classpath).

Only processes rows in `target_row_ids` (the full batch on first entry,
the retry sub-batch on re-entry -- see attribute_auditor.py) so partial
retry never re-calls the LLM for rows that already passed.
"""

from app.llm.base import BaseLLMProvider
from app.master_data.lov_index import LovIndex
from app.pipeline.schemas import AttributeExtractionResult
from app.pipeline.state import BatchState, ExtractedAttributeState


def _build_prompt(row_id: str, part_desc: str, classpath: str | None, permitted_attributes: list[str]) -> str:
    attr_list = ", ".join(permitted_attributes) if permitted_attributes else "(none known for this classpath)"
    return (
        f"row_id: {row_id}\n"
        f"Extract structured attributes from this product description.\n"
        f"Description: {part_desc}\n"
        f"Classpath: {classpath or 'unknown'}\n"
        f"Permitted attribute labels for this classpath: {attr_list}\n"
        f"Return only attributes whose value is present or clearly implied by the description."
    )


async def extract_attributes(
    batch: BatchState,
    provider: BaseLLMProvider,
    lov_index: LovIndex,
    target_row_ids: list[str] | None = None,
) -> BatchState:
    targets = {row.row_id for row in batch.rows} if target_row_ids is None else set(target_row_ids)
    rows_to_process = [row for row in batch.rows if row.row_id in targets]
    if not rows_to_process:
        return batch

    prompts = [
        _build_prompt(
            row.row_id,
            row.raw_row.part_desc,
            row.classpath,
            lov_index.attributes_for_classpath(row.classpath) if row.classpath else [],
        )
        for row in rows_to_process
    ]

    results = await provider.generate_structured_batch(prompts, AttributeExtractionResult)
    results_by_row_id = {r.row_id: r for r in results}

    for row in rows_to_process:
        result = results_by_row_id.get(row.row_id)
        if result is None:
            continue
        row.attributes = [
            ExtractedAttributeState(label=a.label, value=a.value, uom=a.uom) for a in result.attributes
        ]

    return batch
