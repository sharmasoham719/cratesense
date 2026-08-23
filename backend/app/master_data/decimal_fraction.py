"""
Decimal <-> fraction (in 64ths) conversion lookup.

Per knowledge-base/provided-docs/Solution_Guide.md §2: manufacturers publish
decimals, trade buyers search fractions -- convert 0.5 to 1/2, 50.25 in to
50-1/4 in. This module handles the whole-number + fraction composition
("50-1/4"), not just the bare 0-1 fraction table.
"""

from fractions import Fraction

import pandas as pd


class DecimalFractionTable:
    def __init__(self, decimal_fraction_df: pd.DataFrame):
        self._decimal_to_fraction: dict[float, str] = {}
        for _, row in decimal_fraction_df.iterrows():
            self._decimal_to_fraction[round(float(row["Decimal"]), 6)] = str(row["Fraction"])

    def fraction_for_decimal(self, decimal_part: float) -> str | None:
        """Look up the 64ths-fraction string for a decimal in [0, 1)."""
        key = round(decimal_part, 6)
        return self._decimal_to_fraction.get(key)

    def to_fraction_string(self, value: float, tolerance: float = 1e-4) -> str:
        """Convert a decimal measurement (e.g. 50.25) to its fraction display
        form (e.g. "50-1/4"). Falls back to the reduced fraction via Python's
        Fraction if no exact 64ths match exists within tolerance."""
        whole = int(value)
        remainder = round(value - whole, 6)

        if remainder == 0:
            return str(whole)

        best_match = self.fraction_for_decimal(remainder)
        if best_match is None:
            for known_decimal, fraction_str in self._decimal_to_fraction.items():
                if abs(known_decimal - remainder) <= tolerance:
                    best_match = fraction_str
                    break

        if best_match is None:
            frac = Fraction(remainder).limit_denominator(64)
            best_match = f"{frac.numerator}/{frac.denominator}"

        return f"{whole}-{best_match}" if whole else best_match
