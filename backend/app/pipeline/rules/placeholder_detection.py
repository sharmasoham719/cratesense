"""
Placeholder-leakage detection: has a generated description accidentally
included a raw-data placeholder value or generic filler text, instead of
either real content or a clean omission?

knowledge-base/HACKATHON_STATEMENT.md §4.2: "no placeholder leakage
(-- Unbranded -- etc.)". The exact placeholder strings are the canonical
source used by pipeline/nodes/filter_placeholders.py -- defined here so
both modules share one list rather than duplicating it.
"""

import re
from dataclasses import dataclass

# Canonical placeholder values from raw input data, per
# knowledge-base/provided-docs/Sample_Dataset_Input.md.
RAW_DATA_PLACEHOLDERS = {
    "-- Unbranded --",
    "-- No Unilog Brand --",
    "-- No DIB Brand --",
    "-",
}

# Generic filler text that indicates ungenerated/placeholder content in a
# description, distinct from raw-data placeholders above. Grounded in the
# MOCK-RED-001 mock LLM fixture (app/llm/mock_data/), authored specifically
# to exercise this rule.
_GENERIC_FILLER_PATTERNS = [
    re.compile(r"\bTBD\b", re.IGNORECASE),
    re.compile(r"\bTODO\b", re.IGNORECASE),
    re.compile(r"\bn/a\b", re.IGNORECASE),
    re.compile(r"\bplaceholder\b", re.IGNORECASE),
]


@dataclass(frozen=True)
class PlaceholderLeakageResult:
    passed: bool
    detail: str


def check_no_placeholder_leakage(text: str) -> PlaceholderLeakageResult:
    stripped = text.strip()

    if not stripped:
        return PlaceholderLeakageResult(False, "text is empty")

    for placeholder in RAW_DATA_PLACEHOLDERS:
        if placeholder != "-" and placeholder in stripped:
            return PlaceholderLeakageResult(False, f'raw-data placeholder leaked: "{placeholder}"')

    for pattern in _GENERIC_FILLER_PATTERNS:
        match = pattern.search(stripped)
        if match:
            return PlaceholderLeakageResult(False, f'generic filler text found: "{match.group()}"')

    return PlaceholderLeakageResult(True, "no placeholder leakage detected")
