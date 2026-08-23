"""
DescriptionAuditor: deterministic rule engine. Scores each row's
descriptions red/amber/green per knowledge-base/HACKATHON_STATEMENT.md
§4.2 ("Description: within character limit? correct casing? follows the
construction formula? no placeholder leakage?"), then splits the batch
into accepted rows vs. a retry sub-batch for DescriptionBuilder.

Reuses the Goal 4 rule modules directly rather than reimplementing
scoring -- this node is a thin orchestrator over char_limits.py,
casing.py, formula_adherence.py, and placeholder_detection.py.
"""

from app.config import Settings
from app.pipeline.rules.casing import check_casing
from app.pipeline.rules.char_limits import check_char_limit
from app.pipeline.rules.formula_adherence import FormulaComponents, check_formula_adherence
from app.pipeline.rules.placeholder_detection import check_no_placeholder_leakage
from app.pipeline.state import BatchState, RowState, RuleCheckState

GREEN_THRESHOLD = 0.5
AMBER_THRESHOLD = 0.4

# The Brand + Series + MPN + Item Type + key attrs formula
# (knowledge-base/HACKATHON_STATEMENT.md §4.1/§4.2) applies to the
# expansive formats, not INVOICE_DESC -- real ground truth
# (knowledge-base/provided-docs/Unihack_Expected_Output_Delivery_Format.csv)
# shows invoice descriptions are deliberately terse/abbreviated and never
# include brand or MPN (e.g. "DISHWASHER LEG 5 SST 120V 15A 50-1/4IN" has
# neither "FRIGIDAIRE" nor "PDSH4816AF"). Discovered while smoke-testing
# this node against real ground truth -- checking formula adherence on
# invoice_desc was scoring the correct, real text as a failure.
_FORMULA_APPLICABLE_FORMATS = {"mobile_desc", "short_desc", "long_desc", "retail_desc", "marketing_description"}


# "Key attributes" in the real formula (knowledge-base/HACKATHON_STATEMENT.md
# §4.1) means a curated subset a human copywriter would pick as headline
# facts, not every extracted attribute -- no real description mentions all
# 7 attributes a row might have. Checking presence of every green attribute
# was over-strict (discovered via smoke test against real ground truth,
# which legitimately omits most attributes from any single description
# format). Capped to the top N attributes as a practical stand-in for
# "key" until real curation logic/Content Guidelines rules exist.
_MAX_KEY_ATTRIBUTES_TO_CHECK = 3


def _formula_components_for_row(row: RowState) -> FormulaComponents:
    key_attrs = [a.value for a in row.attributes if a.marker == "green"][:_MAX_KEY_ATTRIBUTES_TO_CHECK]
    return FormulaComponents(
        brand=row.brand_name,
        mpn=row.row_id,
        key_attribute_values=key_attrs,
    )


def _rule_checks_for_description(format_name: str, text: str, row: RowState) -> list[RuleCheckState]:
    char_limit = check_char_limit(format_name, text)
    casing = check_casing(format_name, text)
    placeholder = check_no_placeholder_leakage(text)
    checks = [
        RuleCheckState(rule="char_limit", passed=char_limit.passed, detail=char_limit.detail),
        RuleCheckState(rule="casing", passed=casing.passed, detail=casing.detail),
        RuleCheckState(rule="no_placeholder_leakage", passed=placeholder.passed, detail=placeholder.detail),
    ]
    if format_name in _FORMULA_APPLICABLE_FORMATS:
        formula = check_formula_adherence(text, _formula_components_for_row(row))
        checks.append(RuleCheckState(rule="formula_adherence", passed=formula.passed, detail=formula.detail))
    return checks


def _score_description(rule_checks: list[RuleCheckState]) -> tuple[float, str]:
    fraction = sum(1 for c in rule_checks if c.passed) / len(rule_checks)

    if fraction > GREEN_THRESHOLD:
        marker = "green"
    elif fraction >= AMBER_THRESHOLD:
        marker = "amber"
    else:
        marker = "red"

    return fraction, marker


def audit_descriptions(batch: BatchState, settings: Settings) -> BatchState:
    retry_ids: list[str] = []

    for row in batch.rows:
        if not row.descriptions:
            continue

        worst_marker = "green"
        for format_name, desc_state in row.descriptions.items():
            rule_checks = _rule_checks_for_description(format_name, desc_state.text, row)
            fraction, marker = _score_description(rule_checks)
            desc_state.confidence = fraction
            desc_state.marker = marker
            desc_state.rule_checks = rule_checks
            if marker == "red" or (marker == "amber" and worst_marker == "green"):
                worst_marker = marker

        if worst_marker in ("red", "amber") and row.retry_counts["description"] < settings.max_node_retries:
            row.retry_counts["description"] += 1
            retry_ids.append(row.row_id)

    batch.pending_retry_row_ids = retry_ids
    return batch
