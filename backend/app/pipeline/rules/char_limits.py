"""
Character-limit rules per description format.

Only INVOICE_DESC and MOBILE_DESC have explicitly documented limits
(knowledge-base/HACKATHON_STATEMENT.md §5, knowledge-base/provided-docs/
Expected_Output_Delivery_Format.md): Invoice <=40 char, Mobile 60-80 char.
SHORT/LONG/RETAIL/MARKETING descriptions have no stated hard limit in the
provided materials -- rather than inventing a number, those formats are
checked only for non-emptiness here (a real limit can be added later if
the actual Content Guidelines doc is ever obtained).
"""

from dataclasses import dataclass

# Formats with an explicit, documented character limit.
CHAR_LIMITS = {
    "invoice_desc": (0, 40),
    "mobile_desc": (60, 80),
}

NO_LIMIT_FORMATS = {"short_desc", "long_desc", "retail_desc", "marketing_description"}


@dataclass(frozen=True)
class CharLimitResult:
    passed: bool
    detail: str


def check_char_limit(format_name: str, text: str) -> CharLimitResult:
    if format_name in CHAR_LIMITS:
        min_len, max_len = CHAR_LIMITS[format_name]
        length = len(text)
        if min_len <= length <= max_len:
            return CharLimitResult(True, f"{length} chars, within [{min_len}, {max_len}]")
        return CharLimitResult(False, f"{length} chars, outside [{min_len}, {max_len}]")

    if format_name in NO_LIMIT_FORMATS:
        if text.strip():
            return CharLimitResult(True, "no documented limit; non-empty")
        return CharLimitResult(False, "no documented limit, but text is empty")

    raise ValueError(f"Unknown description format: {format_name!r}")
