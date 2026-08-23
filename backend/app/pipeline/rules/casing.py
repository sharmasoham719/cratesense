"""
Casing rules per description format, per knowledge-base/HACKATHON_STATEMENT.md
§4.2: "correct casing (CAPS for invoice, sentence case elsewhere)".
"""

import re
from dataclasses import dataclass

_LETTER_RE = re.compile(r"[A-Za-z]")


@dataclass(frozen=True)
class CasingResult:
    passed: bool
    detail: str


def check_casing(format_name: str, text: str) -> CasingResult:
    letters = _LETTER_RE.findall(text)
    if not letters:
        return CasingResult(False, "no letters to check casing against")

    if format_name == "invoice_desc":
        is_all_caps = all(c == c.upper() for c in letters)
        if is_all_caps:
            return CasingResult(True, "all-caps, matches invoice casing rule")
        return CasingResult(False, "not all-caps; invoice descriptions must be CAPS")

    # Sentence case elsewhere: not requiring every word capitalized (many real
    # descriptions are title-cased per-word, e.g. "FRIGIDAIRE® Professional
    # Series..."), just that the string isn't degenerate all-lowercase or
    # all-caps prose -- a real all-caps sentence case violation is easy to
    # detect; nuanced title-case-vs-sentence-case grading needs the actual
    # Content Guidelines doc, which wasn't provided.
    is_all_lower = all(c == c.lower() for c in letters)
    is_all_upper = all(c == c.upper() for c in letters)
    if is_all_lower:
        return CasingResult(False, "all-lowercase text is not sentence/title case")
    if is_all_upper:
        return CasingResult(False, "all-caps text outside invoice_desc violates sentence-case rule")
    return CasingResult(True, "mixed case, consistent with sentence/title case")
