"""
Loads the four master data files from MASTER_DATA_DIR into pandas DataFrames.

Real master files (per knowledge-base/provided-docs/Solution_Guide.md §2) have
messy layouts — merged cells, multi-sheet, side-by-side column blocks — so this
loader is deliberately explicit about which sheet/columns it reads rather than
trusting openpyxl/pandas defaults. The fixtures under knowledge-base/master-data/
(*_fixture.xlsx) mirror the real files' documented column shapes exactly, so
swapping in real files later needs no code changes here — only new filenames.
"""

from pathlib import Path

import pandas as pd

LOV_FILENAME = "Unicat_Lov_fixture.xlsx"
MANUFACTURER_FILENAME = "UniCat_Manufacturer_and_Brand_List_fixture.xlsx"
UOM_FILENAME = "Unilog_Master_UOM_Standards_fixture.xlsx"
DECIMAL_FRACTION_FILENAME = "Decimal_Fraction_fixture.xlsx"


class MasterDataLoadError(RuntimeError):
    pass


def _require_file(directory: Path, filename: str) -> Path:
    path = directory / filename
    if not path.exists():
        raise MasterDataLoadError(
            f"Master data file not found: {path}. "
            f"See knowledge-base/master-data/README.md for how to obtain/generate it."
        )
    return path


def load_lov(master_data_dir: str) -> pd.DataFrame:
    path = _require_file(Path(master_data_dir), LOV_FILENAME)
    df = pd.read_excel(path, sheet_name="LOV")
    expected = {
        "Classpath", "Leaf Node", "Filtering Y/N", "Attribute Label",
        "Attribute Values", "Normalized Label", "Normalized Values",
        "Guidelines", "Remarks",
    }
    missing = expected - set(df.columns)
    if missing:
        raise MasterDataLoadError(f"LOV file missing expected columns: {missing}")
    return df


def load_manufacturer_brand(master_data_dir: str) -> pd.DataFrame:
    path = _require_file(Path(master_data_dir), MANUFACTURER_FILENAME)
    df = pd.read_excel(path, sheet_name="Manufacturer_Brand")
    expected = {"MANUFACTURER_NAME", "MANUFACTURER_CODE", "BRAND_NAME", "BRAND_CODE"}
    missing = expected - set(df.columns)
    if missing:
        raise MasterDataLoadError(f"Manufacturer/Brand file missing expected columns: {missing}")
    return df


def load_uom(master_data_dir: str) -> pd.DataFrame:
    path = _require_file(Path(master_data_dir), UOM_FILENAME)
    df = pd.read_excel(path, sheet_name="UOM_Abbreviations")
    expected = {"Measurement Type", "Approved Abbreviation", "Capture Form Example"}
    missing = expected - set(df.columns)
    if missing:
        raise MasterDataLoadError(f"UOM file missing expected columns: {missing}")
    return df


def load_decimal_fraction(master_data_dir: str) -> pd.DataFrame:
    path = _require_file(Path(master_data_dir), DECIMAL_FRACTION_FILENAME)
    df = pd.read_excel(path, sheet_name="Decimal_Fraction")
    expected = {"Fraction", "Decimal"}
    missing = expected - set(df.columns)
    if missing:
        raise MasterDataLoadError(f"Decimal-Fraction file missing expected columns: {missing}")
    return df
