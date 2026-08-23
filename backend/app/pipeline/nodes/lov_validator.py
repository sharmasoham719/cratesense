"""
LOVValidator: deterministic check -- does each row's extracted attribute
value exist in the LOV for that row's classpath (exact or normalized match)?
knowledge-base/BACKEND_COGNITIVE_FLOW.md §4.

Operates on whatever attributes are already in RowState.attributes -- in
Goal 3 that's hand-built test data; from Goal 5 onward it's AttributeExtractor's
output. This node doesn't care which.
"""

from app.master_data.lov_index import LovIndex
from app.pipeline.state import BatchState

NOT_IN_LOV_FLAG = "attribute_not_in_lov"


def validate_against_lov(batch: BatchState, lov_index: LovIndex) -> BatchState:
    for row in batch.rows:
        if row.classpath is None:
            continue  # ClasspathResolver already flagged this row; nothing to validate against

        for attr in row.attributes:
            if lov_index.is_valid_value(row.classpath, attr.label, attr.value):
                normalized = lov_index.normalize_value(row.classpath, attr.label, attr.value)
                if normalized is not None:
                    attr.value = normalized
            else:
                row.flags.append(f"{NOT_IN_LOV_FLAG}:{attr.label}={attr.value}")

    return batch
