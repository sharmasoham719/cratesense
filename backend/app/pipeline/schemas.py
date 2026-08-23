"""
Pydantic schemas for the two LLM-touching pipeline stages
(knowledge-base/BACKEND_COGNITIVE_FLOW.md §4): AttributeExtractor and
DescriptionBuilder. Used as the `schema` argument to BaseLLMProvider's
generate_structured[_batch] -- both the real and mock providers return
instances of these.
"""

from pydantic import BaseModel


class ExtractedAttribute(BaseModel):
    label: str
    value: str
    uom: str | None = None


class AttributeExtractionResult(BaseModel):
    row_id: str  # Mfg_Part_Num, ties the result back to its row
    attributes: list[ExtractedAttribute]


class DescriptionSet(BaseModel):
    invoice_desc: str
    mobile_desc: str
    short_desc: str
    long_desc: str
    retail_desc: str
    marketing_description: str


class DescriptionGenerationResult(BaseModel):
    row_id: str
    descriptions: DescriptionSet
