"""
Ground truth for evaluation scoring, per
knowledge-base/HACKATHON_STATEMENT.md §3: "Field-level accuracy against
the 200-item ground-truth Delivery Format file."

The real 200-item ground truth was never provided in this repo (see
knowledge-base/provided-docs/Expected_Output_Delivery_Format.md -- only
2 fully-enriched rows are present, out of the stated 200). This module
is the honest, minimal ground-truth set this harness can actually
compare against: the 2 real rows we do have, hand-transcribed from
knowledge-base/provided-docs/Unihack_Expected_Output_Delivery_Format.csv.

Scoring code in scorer.py is written generically against "whatever rows
have ground truth" so it would keep working unchanged if the real
200-item file is ever obtained and dropped in here.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class GroundTruthAttribute:
    label: str
    value: str
    uom: str | None = None


@dataclass(frozen=True)
class GroundTruthRow:
    mfg_part_num: str
    classpath: str
    manufacturer_name: str
    brand_name: str
    invoice_desc: str
    mobile_desc: str
    attributes: list[GroundTruthAttribute] = field(default_factory=list)


# Real ground truth, transcribed from knowledge-base/provided-docs/
# Unihack_Expected_Output_Delivery_Format.csv.
GROUND_TRUTH: dict[str, GroundTruthRow] = {
    "PDSH4816AF": GroundTruthRow(
        mfg_part_num="PDSH4816AF",
        classpath="Appliances & Consumer Electronics>Kitchen Appliances>Built-In Dishwashers",
        manufacturer_name="Rheem Manufacturing",
        brand_name="FRIGIDAIRE®",
        invoice_desc="DISHWASHER LEG 5 SST 120V 15A 50-1/4IN",
        mobile_desc="Rheem Manufacturing FRIGIDAIRE, Dishwasher, Professional Series, PDSH4816AF",
        attributes=[
            GroundTruthAttribute("Series", "Professional Series"),
            GroundTruthAttribute("Number of Wash Cycles", "5"),
            GroundTruthAttribute("Voltage Rating", "120", "V"),
            GroundTruthAttribute("Amperage Rating", "15", "A"),
            GroundTruthAttribute("Mounting Type", "Leg"),
            GroundTruthAttribute("Sound Level", "47", "dBA"),
            GroundTruthAttribute("Material", "Stainless Steel"),
        ],
    ),
    "WDTS7024RZ": GroundTruthRow(
        mfg_part_num="WDTS7024RZ",
        classpath="Appliances & Consumer Electronics>Kitchen Appliances>Built-In Dishwashers",
        manufacturer_name="Whirlpool Corporation",
        brand_name="Whirlpool®",
        invoice_desc="DISHWASHER BLTLN SST SST 120V 10A 41DBA",
        mobile_desc="Whirlpool, Dishwasher, Eco Series, WDTS7024RZ, Built-in Mounting",
        attributes=[
            GroundTruthAttribute("Series", "Eco Series"),
            GroundTruthAttribute("Voltage Rating", "120", "V"),
            GroundTruthAttribute("Amperage Rating", "10", "A"),
            GroundTruthAttribute("Mounting Type", "Built-in"),
            GroundTruthAttribute("Sound Level", "41", "dBA"),
            GroundTruthAttribute("Material", "Stainless Steel"),
            GroundTruthAttribute("Color", "Stainless Steel"),
        ],
    ),
}


def has_ground_truth(mfg_part_num: str) -> bool:
    return mfg_part_num in GROUND_TRUTH


def get_ground_truth(mfg_part_num: str) -> GroundTruthRow | None:
    return GROUND_TRUTH.get(mfg_part_num)
