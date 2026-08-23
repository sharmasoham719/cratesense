"""
Loads the real 1,000-row working dataset from
knowledge-base/provided-docs/Unihack_Sample_Dataset_Input.csv, per
knowledge-base/provided-docs/Sample_Dataset_Input.md.

This is genuinely different from master_data/loader.py's fixture .xlsx
files: those are hand-authored stand-ins for master data (LOV,
manufacturer list, etc.) that was never provided, whereas this file IS
the real, provided working data -- the actual 1,000-row Sample Dataset
Input. Per the gap logged in development-progress/TASK_LIST.md Goal 4
(resolved here at Goal 9): through Goal 8, only 2-3 rows from this file
had ever been used anywhere in the pipeline, as hardcoded test fixtures
-- this module is what finally wires the FULL file in, for api/rows.py.
"""

import csv
from pathlib import Path

SAMPLE_DATASET_FILENAME = "Unihack_Sample_Dataset_Input.csv"


class SampleDatasetLoadError(RuntimeError):
    pass


def load_sample_dataset(provided_docs_dir: str) -> list[dict]:
    """Returns the raw rows as a list of dicts with the 6 real columns
    (Mfg_Part_Num, Part_Desc, E1_Brand, Unilog_Brand, DIB_Brand,
    Part_Manuf), in file order. No cleaning/placeholder-filtering here --
    that's FilterPlaceholders' job once a row enters the pipeline."""
    path = Path(provided_docs_dir) / SAMPLE_DATASET_FILENAME
    if not path.exists():
        raise SampleDatasetLoadError(
            f"Sample dataset file not found: {path}. Expected the real "
            f"provided working data at knowledge-base/provided-docs/."
        )

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    expected_columns = {"Mfg_Part_Num", "Part_Desc", "E1_Brand", "Unilog_Brand", "DIB_Brand", "Part_Manuf"}
    if rows and not expected_columns.issubset(rows[0].keys()):
        missing = expected_columns - set(rows[0].keys())
        raise SampleDatasetLoadError(f"Sample dataset file missing expected columns: {missing}")

    return rows


def find_row_by_mfg_part_num(provided_docs_dir: str, mfg_part_num: str) -> dict | None:
    rows = load_sample_dataset(provided_docs_dir)
    for row in rows:
        if row["Mfg_Part_Num"] == mfg_part_num:
            return row
    return None
