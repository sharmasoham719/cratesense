"""
Fuzzy manufacturer/brand normalizer over the UniCat Manufacturer and Brand List.

Matches a messy supplier string (e.g. "Freud Inc (2435)" from Part_Manuf,
per knowledge-base/provided-docs/Sample_Dataset_Input.md) to the canonical
MANUFACTURER_NAME + paired BRAND_NAME, using RapidFuzz per
knowledge-base/TECH_STACK.md §2 (exact/fuzzy indexed lookup, no embeddings).
"""

import re
from dataclasses import dataclass

import pandas as pd
from rapidfuzz import fuzz, process

_CODE_SUFFIX_RE = re.compile(r"\s*\([^)]*\)\s*$")


@dataclass(frozen=True)
class ManufacturerMatch:
    manufacturer_name: str
    manufacturer_code: str
    brand_name: str
    brand_code: str
    score: float


class ManufacturerIndex:
    def __init__(self, manufacturer_df: pd.DataFrame, min_score: float = 80.0):
        self._df = manufacturer_df.reset_index(drop=True)
        self._min_score = min_score
        self._names = self._df["MANUFACTURER_NAME"].astype(str).tolist()

    @staticmethod
    def strip_code_suffix(raw: str) -> str:
        """Strip a trailing "(CODE)" suffix, e.g. "Freud Inc (2435)" -> "Freud Inc"."""
        return _CODE_SUFFIX_RE.sub("", raw).strip()

    def match(self, raw_manufacturer: str) -> ManufacturerMatch | None:
        if not raw_manufacturer or not raw_manufacturer.strip():
            return None

        cleaned = self.strip_code_suffix(raw_manufacturer)

        # token_sort_ratio (not WRatio): WRatio produced a confident-looking
        # false positive on real data ("Wera Tools NA Inc" -> "Freud Inc" at
        # 85.5, above the 80.0 cutoff) despite the two strings sharing almost
        # no real content (token_sort_ratio scores that pair at 23). WRatio
        # overweights partial/substring similarity in a way that's fine for
        # near-duplicates but unsafe for a small reference list where an
        # unmatched input should fall through to UNMATCHED_FLAG rather than
        # be silently misassigned to an unrelated manufacturer/brand.
        result = process.extractOne(
            cleaned, self._names, scorer=fuzz.token_sort_ratio, score_cutoff=self._min_score
        )
        if result is None:
            return None

        matched_name, score, idx = result
        row = self._df.iloc[idx]
        return ManufacturerMatch(
            manufacturer_name=row["MANUFACTURER_NAME"],
            manufacturer_code=str(row["MANUFACTURER_CODE"]),
            brand_name=row["BRAND_NAME"],
            brand_code=str(row["BRAND_CODE"]),
            score=score,
        )
