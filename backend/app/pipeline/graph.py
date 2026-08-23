"""
LangGraph wiring for the full pipeline (knowledge-base/BACKEND_COGNITIVE_FLOW.md §2):

  FilterPlaceholders -> ClasspathResolver -> ManufacturerBrandNormalizer ->
  AttributeExtractor -> LOVValidator -> UOMNormalizer -> AttributeAuditor ->
    [retry AttributeExtractor on pending_retry_row_ids, up to MAX_NODE_RETRIES]
    -> (attribute phase done) ->
  DescriptionBuilder -> DescriptionAuditor ->
    [retry DescriptionBuilder on pending_retry_row_ids, up to MAX_NODE_RETRIES]
    -> END

Graph state is BatchState itself (a batch of RowState) -- see
knowledge-base/BACKEND_COGNITIVE_FLOW.md §6 for the full state shape.

`pending_retry_row_ids` is reused across both retry loops (it means
"whichever phase's auditor last ran flagged these rows"). AttributeAuditor's
"done" transition clears it before DescriptionBuilder runs, so the
description phase never inherits stale attribute-retry ids -- see
_clear_retry_ids_for_description_phase.

RecordAssembler is NOT a graph node -- it's a pure output-shaping function
(pipeline/nodes/record_assembler.py) called after the graph finishes,
since it has no branching/retry behavior of its own.
"""

from collections.abc import Awaitable, Callable

from langgraph.graph import END, StateGraph

from app.config import Settings
from app.llm.base import BaseLLMProvider
from app.master_data.lov_index import LovIndex
from app.master_data.manufacturer_index import ManufacturerIndex
from app.master_data.uom_index import UomIndex
from app.pipeline.nodes.attribute_auditor import audit_attributes
from app.pipeline.nodes.attribute_extractor import extract_attributes
from app.pipeline.nodes.classpath_resolver import resolve_classpath
from app.pipeline.nodes.description_auditor import audit_descriptions
from app.pipeline.nodes.description_builder import build_descriptions
from app.pipeline.nodes.filter_placeholders import filter_placeholders
from app.pipeline.nodes.ingest import ingest_batch
from app.pipeline.nodes.lov_validator import validate_against_lov
from app.pipeline.nodes.manufacturer_brand_normalizer import normalize_manufacturer_brand
from app.pipeline.nodes.uom_normalizer import normalize_uom
from app.pipeline.state import BatchState


def build_pipeline_graph(
    provider: BaseLLMProvider,
    lov_index: LovIndex,
    manufacturer_index: ManufacturerIndex,
    uom_index: UomIndex,
    settings: Settings,
):
    """Returns a compiled LangGraph app covering both the attribute-
    extraction and description-generation halves. Invoke with
    `await app.ainvoke(batch_state)` where batch_state was built via
    pipeline.nodes.ingest.ingest_batch."""

    async def node_filter_placeholders(state: BatchState) -> BatchState:
        return filter_placeholders(state)

    async def node_resolve_classpath(state: BatchState) -> BatchState:
        return resolve_classpath(state, lov_index)

    async def node_normalize_manufacturer_brand(state: BatchState) -> BatchState:
        return normalize_manufacturer_brand(state, manufacturer_index)

    async def node_extract_attributes(state: BatchState) -> BatchState:
        target_ids = state.pending_retry_row_ids or None
        return await extract_attributes(state, provider, lov_index, target_ids)

    async def node_validate_against_lov(state: BatchState) -> BatchState:
        return validate_against_lov(state, lov_index)

    async def node_normalize_uom(state: BatchState) -> BatchState:
        return normalize_uom(state, uom_index)

    async def node_audit_attributes(state: BatchState) -> BatchState:
        return audit_attributes(state, settings)

    async def node_clear_retry_ids_for_description_phase(state: BatchState) -> BatchState:
        # AttributeAuditor's retry loop is finished; pending_retry_row_ids
        # must not leak into DescriptionAuditor's own retry tracking.
        state.pending_retry_row_ids = []
        return state

    async def node_build_descriptions(state: BatchState) -> BatchState:
        target_ids = state.pending_retry_row_ids or None
        return await build_descriptions(state, provider, target_ids)

    async def node_audit_descriptions(state: BatchState) -> BatchState:
        return audit_descriptions(state, settings)

    def route_after_attribute_audit(state: BatchState) -> str:
        return "retry" if state.pending_retry_row_ids else "done"

    def route_after_description_audit(state: BatchState) -> str:
        return "retry" if state.pending_retry_row_ids else "done"

    graph = StateGraph(BatchState)
    graph.add_node("FilterPlaceholders", node_filter_placeholders)
    graph.add_node("ClasspathResolver", node_resolve_classpath)
    graph.add_node("ManufacturerBrandNormalizer", node_normalize_manufacturer_brand)
    graph.add_node("AttributeExtractor", node_extract_attributes)
    graph.add_node("LOVValidator", node_validate_against_lov)
    graph.add_node("UOMNormalizer", node_normalize_uom)
    graph.add_node("AttributeAuditor", node_audit_attributes)
    graph.add_node("ClearRetryIdsForDescriptionPhase", node_clear_retry_ids_for_description_phase)
    graph.add_node("DescriptionBuilder", node_build_descriptions)
    graph.add_node("DescriptionAuditor", node_audit_descriptions)

    graph.set_entry_point("FilterPlaceholders")
    graph.add_edge("FilterPlaceholders", "ClasspathResolver")
    graph.add_edge("ClasspathResolver", "ManufacturerBrandNormalizer")
    graph.add_edge("ManufacturerBrandNormalizer", "AttributeExtractor")
    graph.add_edge("AttributeExtractor", "LOVValidator")
    graph.add_edge("LOVValidator", "UOMNormalizer")
    graph.add_edge("UOMNormalizer", "AttributeAuditor")
    graph.add_conditional_edges(
        "AttributeAuditor",
        route_after_attribute_audit,
        {"retry": "AttributeExtractor", "done": "ClearRetryIdsForDescriptionPhase"},
    )
    graph.add_edge("ClearRetryIdsForDescriptionPhase", "DescriptionBuilder")
    graph.add_edge("DescriptionBuilder", "DescriptionAuditor")
    graph.add_conditional_edges(
        "DescriptionAuditor",
        route_after_description_audit,
        {"retry": "DescriptionBuilder", "done": END},
    )

    return graph.compile()


NodeTransitionCallback = Callable[[str, BatchState], Awaitable[None]]


async def run_pipeline(
    raw_rows: list[dict],
    batch_id: str,
    provider: BaseLLMProvider,
    lov_index: LovIndex,
    manufacturer_index: ManufacturerIndex,
    uom_index: UomIndex,
    settings: Settings,
    on_node_transition: NodeTransitionCallback | None = None,
) -> BatchState:
    """Convenience entry point: ingest raw rows, run the full compiled
    graph, return the final BatchState.

    If on_node_transition is given, it's awaited after every node
    finishes with (node_name, state_after_node) -- this is what makes
    real per-row, per-node SSE progress possible (the gap noted when
    jobs/worker.py was first written at Goal 7). Uses LangGraph's
    astream() instead of ainvoke() so this needs no changes to any node
    function itself; retries naturally show up as the same node name
    recurring (AttributeExtractor fires again for a retry sub-batch)."""
    initial_state = ingest_batch(batch_id, raw_rows)
    app = build_pipeline_graph(provider, lov_index, manufacturer_index, uom_index, settings)

    final_state_dict: dict | None = None
    async for step in app.astream(initial_state, stream_mode="updates"):
        for node_name, node_output in step.items():
            final_state_dict = node_output
            if on_node_transition is not None:
                await on_node_transition(node_name, BatchState.model_validate(node_output))

    if final_state_dict is None:
        raise RuntimeError(f"Pipeline graph produced no output for batch {batch_id}")
    return BatchState.model_validate(final_state_dict)
