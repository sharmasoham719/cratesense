"""
AttributeAuditor: deterministic rule engine. Scores each row's attribute
set red/amber/green per the confidence system in
knowledge-base/HACKATHON_STATEMENT.md §4.2 ("Attribute: value in LOV for
this classpath? UOM in approved abbreviation list?"), then splits the
batch into accepted rows vs. a retry sub-batch for AttributeExtractor.

Runs AFTER LOVValidator and UOMNormalizer in the graph (see
knowledge-base/BACKEND_COGNITIVE_FLOW.md §2) -- reads the flags those two
nodes already set on each row rather than re-implementing the checks.
"""

from app.config import Settings
from app.pipeline.state import BatchState, RowState, RuleCheckState

GREEN_THRESHOLD = 0.5  # >50% of applicable rules pass
AMBER_THRESHOLD = 0.4  # ~40-50% pass


def _score_row_attributes(row: RowState) -> tuple[float, str]:
    """Returns (fraction_passed, marker). An attribute "passes" if it has
    neither an attribute_not_in_lov nor a uom_unrecognized flag referencing it."""
    if not row.attributes:
        return 0.0, "red"

    not_in_lov = {f.split(":", 1)[1].split("=")[0] for f in row.flags if f.startswith("attribute_not_in_lov:")}
    bad_uom = {f.split(":", 1)[1].split("=")[0] for f in row.flags if f.startswith("uom_unrecognized:")}
    flagged_labels = not_in_lov | bad_uom

    total = len(row.attributes)
    passed = sum(1 for a in row.attributes if a.label not in flagged_labels)
    fraction = passed / total

    if fraction > GREEN_THRESHOLD:
        marker = "green"
    elif fraction >= AMBER_THRESHOLD:
        marker = "amber"
    else:
        marker = "red"

    return fraction, marker


def _rule_checks_for_attribute(attr, row: RowState) -> list[RuleCheckState]:
    """Per-attribute rule trace, per knowledge-base/UI_COMPONENT_LIBRARY.md
    §3's FieldRuleTrace contract -- reads the same flags LOVValidator and
    UOMNormalizer already set, rather than re-running those checks."""
    in_lov = f"attribute_not_in_lov:{attr.label}={attr.value}" not in row.flags
    checks = [
        RuleCheckState(
            rule="in_lov",
            passed=in_lov,
            detail="value found in LOV for this classpath" if in_lov else "value not found in LOV for this classpath",
        )
    ]
    if attr.uom is not None:
        uom_ok = not any(f.startswith(f"uom_unrecognized:{attr.label}=") for f in row.flags)
        checks.append(
            RuleCheckState(
                rule="uom_recognized",
                passed=uom_ok,
                detail="unit is an approved abbreviation" if uom_ok else "unit is not an approved abbreviation",
            )
        )
    return checks


def audit_attributes(batch: BatchState, settings: Settings) -> BatchState:
    retry_ids: list[str] = []

    for row in batch.rows:
        fraction, marker = _score_row_attributes(row)
        for attr in row.attributes:
            attr.confidence = fraction
            attr.marker = marker
            attr.rule_checks = _rule_checks_for_attribute(attr, row)

        if marker in ("red", "amber") and row.retry_counts["attribute"] < settings.max_node_retries:
            row.retry_counts["attribute"] += 1
            retry_ids.append(row.row_id)

    batch.pending_retry_row_ids = retry_ids
    return batch
