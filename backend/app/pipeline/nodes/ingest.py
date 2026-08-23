"""
IngestBatch: parses each raw row in a batch into typed RowState.
knowledge-base/BACKEND_COGNITIVE_FLOW.md §4.
"""

from app.pipeline.state import BatchState, RawRow, RowState


def ingest_batch(batch_id: str, raw_rows: list[dict]) -> BatchState:
    """raw_rows: list of dicts with the 6 Sample-1000/Sample-200 columns
    (Mfg_Part_Num, Part_Desc, E1_Brand, Unilog_Brand, DIB_Brand, Part_Manuf)."""
    rows = [
        RowState(
            raw_row=RawRow(
                mfg_part_num=r["Mfg_Part_Num"],
                part_desc=r["Part_Desc"],
                e1_brand=r.get("E1_Brand"),
                unilog_brand=r.get("Unilog_Brand"),
                dib_brand=r.get("DIB_Brand"),
                part_manuf=r.get("Part_Manuf"),
            )
        )
        for r in raw_rows
    ]
    return BatchState(batch_id=batch_id, rows=rows)
