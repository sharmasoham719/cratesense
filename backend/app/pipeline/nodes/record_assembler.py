"""
RecordAssembler: merges a finished RowState into the Delivery Format shape
(knowledge-base/provided-docs/Expected_Output_Delivery_Format.md), attaching
per-field confidence markers.

Only the column groups this pipeline actually populates are assembled here
(raw input carry-through, taxonomy, brand/manufacturer, the 5 description
formats, and structured attributes) -- per knowledge-base/HACKATHON_STATEMENT.md
§2's scope decision, digital assets/codes/dimensions/commerce fields are out
of scope and are not fabricated as blank columns. AssembledRecord.to_delivery_format_dict()
maps populated fields to their real column names for CSV export (Goal 9);
unpopulated real columns are simply absent rather than emitted empty, so a
future widened pipeline can add them without reshaping this function.
"""

from pydantic import BaseModel

from app.pipeline.state import BatchState, RowState, RuleCheckState


class AssembledAttribute(BaseModel):
    label: str
    value: str
    uom: str | None
    marker: str | None
    rule_checks: list[RuleCheckState] = []


class AssembledDescription(BaseModel):
    text: str
    char_count: int
    marker: str | None
    rule_checks: list[RuleCheckState] = []


class AssembledRecord(BaseModel):
    # Raw input carry-through
    mfg_part_num: str
    part_desc: str
    e1_brand: str | None
    unilog_brand: str | None
    dib_brand: str | None
    part_manuf: str | None

    # Taxonomy
    classpath: str | None

    # Brand/Manufacturer (normalized)
    manufacturer_name: str | None
    brand_name: str | None

    # Description formats
    descriptions: dict[str, AssembledDescription]

    # Structured attributes
    attributes: list[AssembledAttribute]

    # Gap/review flags (per knowledge-base/provided-docs/Solution_Guide.md §4:
    # "a confidence score or a 'needs human review' flag is a genuinely
    # valuable feature")
    flags: list[str]

    def to_delivery_format_dict(self) -> dict:
        """Maps populated fields to their real Delivery Format column names
        (knowledge-base/provided-docs/Expected_Output_Delivery_Format.md)."""
        out = {
            "Mfg_Part_Num": self.mfg_part_num,
            "MANUFACTURER_PART_NUMBER": self.mfg_part_num,
            "Part_Desc": self.part_desc,
            "E1_Brand": self.e1_brand,
            "Unilog_Brand": self.unilog_brand,
            "DIB_Brand": self.dib_brand,
            "Part_Manuf": self.part_manuf,
            "Classpath": self.classpath,
            "MANUFACTURER_NAME": self.manufacturer_name,
            "BRAND_NAME": self.brand_name,
        }

        field_to_column = {
            "invoice_desc": "INVOICE_DESC",
            "mobile_desc": "MOBILE_DESC",
            "short_desc": "SHORT_DESC",
            "long_desc": "LONG_DESC1",
            "retail_desc": "RETAIL_DESC",
            "marketing_description": "MARKETING_DESCRIPTION",
        }
        for field_name, column in field_to_column.items():
            if field_name in self.descriptions:
                out[column] = self.descriptions[field_name].text

        for i, attr in enumerate(self.attributes, start=1):
            out[f"ATTRIBUTE_LABEL {i}"] = attr.label
            out[f"ATTRIBUTE_VALUE {i}"] = attr.value
            out[f"ATTRIBUTE_UOM {i}"] = attr.uom

        return out


def assemble_record(row: RowState) -> AssembledRecord:
    return AssembledRecord(
        mfg_part_num=row.raw_row.mfg_part_num,
        part_desc=row.raw_row.part_desc,
        e1_brand=row.raw_row.e1_brand,
        unilog_brand=row.raw_row.unilog_brand,
        dib_brand=row.raw_row.dib_brand,
        part_manuf=row.raw_row.part_manuf,
        classpath=row.classpath,
        manufacturer_name=row.manufacturer_name,
        brand_name=row.brand_name,
        descriptions={
            name: AssembledDescription(text=d.text, char_count=d.char_count, marker=d.marker, rule_checks=d.rule_checks)
            for name, d in row.descriptions.items()
        },
        attributes=[
            AssembledAttribute(label=a.label, value=a.value, uom=a.uom, marker=a.marker, rule_checks=a.rule_checks)
            for a in row.attributes
        ],
        flags=row.flags,
    )


def assemble_batch(batch: BatchState) -> list[AssembledRecord]:
    return [assemble_record(row) for row in batch.rows]
