"""
Free-text unit -> approved abbreviation lookup over the UOM Standards master data.

Per knowledge-base/provided-docs/Solution_Guide.md §2: "the only permitted way
to write a unit anywhere in your output... always keep a space between the
number and the unit (24 in, not 24in)."
"""

import re

import pandas as pd

_NUMBER_UNIT_RE = re.compile(r"^\s*([\d./\-]+)\s*([A-Za-z%°]+.*)\s*$")

# Common free-text variants seen in raw data -> approved abbreviation.
# Grounded in units actually observed in knowledge-base/provided-docs/ ground truth.
_ALIASES = {
    "volt": "V", "volts": "V", "v": "V",
    "amp": "A", "amps": "A", "ampere": "A", "amperes": "A", "a": "A",
    "inch": "in", "inches": "in", "in.": "in", '"': "in",
    "hour": "hr", "hours": "hr", "hr": "hr", "hrs": "hr",
    "db": "dBA", "dba": "dBA",
    "kwh": "kW-hr", "kw-hr": "kW-hr", "kwhr": "kW-hr",
    "gpm": "gpm",
}


class UomIndex:
    def __init__(self, uom_df: pd.DataFrame):
        self._df = uom_df
        self._approved: set[str] = set(uom_df["Approved Abbreviation"].astype(str))

    def is_approved(self, abbreviation: str) -> bool:
        return abbreviation in self._approved

    def normalize_unit(self, raw_unit: str) -> str | None:
        """Map a free-text unit string to its approved abbreviation, or None if unknown."""
        key = raw_unit.strip().lower().rstrip(".")
        if key in _ALIASES:
            return _ALIASES[key]
        # Already-approved abbreviations are case-sensitive exact matches
        if raw_unit in self._approved:
            return raw_unit
        return None

    def normalize_value_with_unit(self, raw: str) -> str | None:
        """Normalize a combined "24in" / "24 inches" / "24  IN." style string to
        "24 in" (number, single space, approved unit). Returns None if the unit
        isn't recognized."""
        match = _NUMBER_UNIT_RE.match(raw)
        if not match:
            return None
        number, raw_unit = match.group(1), match.group(2)
        approved = self.normalize_unit(raw_unit)
        if approved is None:
            return None
        return f"{number} {approved}"
