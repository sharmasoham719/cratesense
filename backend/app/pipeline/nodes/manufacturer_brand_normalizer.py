"""
ManufacturerBrandNormalizer: fuzzy-matches each row's Part_Manuf string to
the canonical MANUFACTURER_NAME + paired BRAND_NAME via app.master_data.manufacturer_index.

Per knowledge-base/provided-docs/Solution_Guide.md §2: "Where an item has no
brand, the manufacturer name is used instead."
"""

from app.master_data.manufacturer_index import ManufacturerIndex
from app.pipeline.state import BatchState

UNMATCHED_FLAG = "manufacturer_unmatched"


def normalize_manufacturer_brand(batch: BatchState, manufacturer_index: ManufacturerIndex) -> BatchState:
    for row in batch.rows:
        if not row.raw_row.part_manuf:
            row.flags.append(UNMATCHED_FLAG)
            continue

        match = manufacturer_index.match(row.raw_row.part_manuf)
        if match is None:
            row.flags.append(UNMATCHED_FLAG)
            continue

        row.manufacturer_name = match.manufacturer_name
        # Prefer a real brand field over the manufacturer name; DIB_Brand is
        # the field most often actually populated (per Sample_Dataset_Input.md).
        explicit_brand = row.raw_row.dib_brand or row.raw_row.unilog_brand or row.raw_row.e1_brand
        row.brand_name = explicit_brand or match.brand_name or match.manufacturer_name

    return batch
