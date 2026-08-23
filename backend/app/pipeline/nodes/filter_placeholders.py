"""
FilterPlaceholders: strips placeholder values that mean "empty" per
knowledge-base/provided-docs/Sample_Dataset_Input.md and
knowledge-base/provided-docs/Solution_Guide.md §4 ("Placeholders are not data").
"""

from app.pipeline.rules.placeholder_detection import RAW_DATA_PLACEHOLDERS
from app.pipeline.state import BatchState


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    return None if value.strip() in RAW_DATA_PLACEHOLDERS else value


def filter_placeholders(batch: BatchState) -> BatchState:
    for row in batch.rows:
        row.raw_row.e1_brand = _clean(row.raw_row.e1_brand)
        row.raw_row.unilog_brand = _clean(row.raw_row.unilog_brand)
        row.raw_row.dib_brand = _clean(row.raw_row.dib_brand)
        row.raw_row.part_manuf = _clean(row.raw_row.part_manuf)
    return batch
