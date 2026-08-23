"""
row_state / batch_state carried through the LangGraph pipeline, per
knowledge-base/BACKEND_COGNITIVE_FLOW.md §6. Every node reads and returns
a BatchState; deterministic nodes transform each RowState in the batch,
LLM-calling nodes issue one call per batch/sub-batch (Goal 5/6).
"""

from pydantic import BaseModel, Field


class RawRow(BaseModel):
    """Exactly the 6 columns from Sample-1000_Items / Sample-200 Input,
    per knowledge-base/provided-docs/Sample_Dataset_Input.md."""

    mfg_part_num: str
    part_desc: str
    e1_brand: str | None = None
    unilog_brand: str | None = None
    dib_brand: str | None = None
    part_manuf: str | None = None


class RuleCheckState(BaseModel):
    """One rule's pass/fail verdict on a field, per
    knowledge-base/UI_COMPONENT_LIBRARY.md §3's FieldRuleTrace contract
    (`ruleChecks={[{rule, passed, detail}]}`)."""

    rule: str
    passed: bool
    detail: str


class ExtractedAttributeState(BaseModel):
    label: str
    value: str
    uom: str | None = None
    source_lov_id: str | None = None
    confidence: float | None = None
    marker: str | None = None  # "green" | "amber" | "red", set by AttributeAuditor (Goal 5)
    rule_checks: list[RuleCheckState] = Field(default_factory=list)


class DescriptionState(BaseModel):
    text: str
    char_count: int
    confidence: float | None = None
    marker: str | None = None
    rule_checks: list[RuleCheckState] = Field(default_factory=list)


class RowState(BaseModel):
    raw_row: RawRow
    classpath: str | None = None
    manufacturer_name: str | None = None
    brand_name: str | None = None
    attributes: list[ExtractedAttributeState] = Field(default_factory=list)
    descriptions: dict[str, DescriptionState] = Field(default_factory=dict)
    retry_counts: dict[str, int] = Field(default_factory=lambda: {"attribute": 0, "description": 0})
    flags: list[str] = Field(default_factory=list)

    @property
    def row_id(self) -> str:
        return self.raw_row.mfg_part_num


class BatchState(BaseModel):
    batch_id: str
    rows: list[RowState]
    pending_retry_row_ids: list[str] = Field(default_factory=list)
