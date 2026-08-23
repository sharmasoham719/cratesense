"""
UOMNormalizer: snaps each attribute's free-text unit to the single approved
abbreviation, per knowledge-base/BACKEND_COGNITIVE_FLOW.md §4 and
knowledge-base/provided-docs/Solution_Guide.md §2 ("always keep a space
between the number and the unit").
"""

from app.master_data.uom_index import UomIndex
from app.pipeline.state import BatchState

UNRECOGNIZED_UOM_FLAG = "uom_unrecognized"


def normalize_uom(batch: BatchState, uom_index: UomIndex) -> BatchState:
    for row in batch.rows:
        for attr in row.attributes:
            if attr.uom is None:
                continue

            approved = uom_index.normalize_unit(attr.uom)
            if approved is not None:
                attr.uom = approved
            else:
                row.flags.append(f"{UNRECOGNIZED_UOM_FLAG}:{attr.label}={attr.uom}")

    return batch
