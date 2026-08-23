"""
Construction formula adherence: does a description contain the expected
components, per knowledge-base/HACKATHON_STATEMENT.md §4.1/§4.2:
"Product Title = Brand + Series + MPN + Item Type + key attributes".

Presence-based, not exact-order/exact-string matching -- the real Content
Guidelines formulas (which weren't provided) presumably specify exact
construction rules per format; without that doc, this checks the
achievable, generalizable signal: are the row's actual resolved
brand/MPN/key-attribute values present in the generated text at all.

Two things this deliberately does NOT do, discovered by smoke-testing
against real ground truth (knowledge-base/provided-docs/):
1. Exact-symbol brand matching -- real descriptions sometimes drop the
   (R)/(TM) symbol on brand mentions in shorter formats (e.g. MOBILE_DESC
   says "FRIGIDAIRE" with no (R), while SHORT_DESC says "FRIGIDAIRE(R)").
   Brand comparison strips trademark/registration symbols before matching.
2. Requiring EVERY resolved attribute to appear in the text -- "key
   attributes" in the real formula means a curated subset, not all of
   them; no real description mentions all 7 extracted attributes. Only
   `key_attribute_values` explicitly passed in are checked, so callers
   choose which attributes are "key" rather than this module assuming
   "all of them."
"""

import re
from dataclasses import dataclass

_TRADEMARK_SYMBOLS_RE = re.compile(r"[®™]")


def _normalize_for_match(value: str) -> str:
    return _TRADEMARK_SYMBOLS_RE.sub("", value).strip().lower()


@dataclass(frozen=True)
class FormulaComponents:
    brand: str | None = None
    series: str | None = None
    mpn: str | None = None
    item_type: str | None = None
    key_attribute_values: list[str] | None = None


@dataclass(frozen=True)
class FormulaAdherenceResult:
    passed: bool
    detail: str
    present_components: list[str]
    missing_components: list[str]


def check_formula_adherence(text: str, components: FormulaComponents) -> FormulaAdherenceResult:
    text_normalized = _normalize_for_match(text)

    candidates: dict[str, str | None] = {
        "brand": components.brand,
        "series": components.series,
        "mpn": components.mpn,
        "item_type": components.item_type,
    }
    for i, value in enumerate(components.key_attribute_values or []):
        candidates[f"key_attribute_{i}"] = value

    present: list[str] = []
    missing: list[str] = []
    for name, value in candidates.items():
        if value is None or not value.strip():
            continue  # component not applicable to this row; don't penalize
        if _normalize_for_match(value) in text_normalized:
            present.append(name)
        else:
            missing.append(name)

    applicable = present + missing
    if not applicable:
        return FormulaAdherenceResult(False, "no formula components to check against", [], [])

    passed = len(missing) == 0
    detail = f"{len(present)}/{len(applicable)} components present"
    return FormulaAdherenceResult(passed, detail, present, missing)
