"""
Classpath -> permitted attributes index over the LOV master data.

Used by ClasspathResolver (to know which attributes apply to a classpath)
and LOVValidator (to check whether an extracted attribute value is an
approved value for that classpath) — see knowledge-base/BACKEND_COGNITIVE_FLOW.md.
"""

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class LovEntry:
    classpath: str
    leaf_node: str
    attribute_label: str
    attribute_value: str
    normalized_label: str
    normalized_value: str
    filtering: bool


class LovIndex:
    def __init__(self, lov_df: pd.DataFrame):
        self._df = lov_df
        self._by_classpath: dict[str, list[LovEntry]] = {}
        self._leaf_node_by_classpath: dict[str, str] = {}
        for _, row in lov_df.iterrows():
            entry = LovEntry(
                classpath=row["Classpath"],
                leaf_node=row["Leaf Node"],
                attribute_label=row["Attribute Label"],
                attribute_value=str(row["Attribute Values"]),
                normalized_label=row["Normalized Label"],
                normalized_value=str(row["Normalized Values"]),
                filtering=str(row["Filtering Y/N"]).strip().upper() == "Y",
            )
            self._by_classpath.setdefault(entry.classpath, []).append(entry)
            self._leaf_node_by_classpath[entry.classpath] = entry.leaf_node

    def classpaths(self) -> list[str]:
        return list(self._by_classpath.keys())

    def leaf_node_for_classpath(self, classpath: str) -> str | None:
        return self._leaf_node_by_classpath.get(classpath)

    def classpaths_with_leaf_nodes(self) -> list[tuple[str, str]]:
        """All (classpath, leaf_node) pairs -- the data-driven source for
        keyword-based classpath resolution (see pipeline/nodes/classpath_resolver.py)."""
        return list(self._leaf_node_by_classpath.items())

    def attributes_for_classpath(self, classpath: str) -> list[str]:
        """Distinct attribute labels permitted for this classpath, in first-seen order."""
        entries = self._by_classpath.get(classpath, [])
        seen: list[str] = []
        for e in entries:
            if e.attribute_label not in seen:
                seen.append(e.attribute_label)
        return seen

    def is_valid_value(self, classpath: str, attribute_label: str, value: str) -> bool:
        """Exact or normalized-match check: is `value` an approved LOV value
        for this classpath + attribute?"""
        entries = self._by_classpath.get(classpath, [])
        value_norm = value.strip().lower()
        for e in entries:
            if e.attribute_label != attribute_label:
                continue
            if e.attribute_value.strip().lower() == value_norm:
                return True
            if e.normalized_value.strip().lower() == value_norm:
                return True
        return False

    def normalize_value(self, classpath: str, attribute_label: str, value: str) -> str | None:
        """Return the LOV's normalized form of `value`, or None if not found."""
        entries = self._by_classpath.get(classpath, [])
        value_norm = value.strip().lower()
        for e in entries:
            if e.attribute_label != attribute_label:
                continue
            if e.attribute_value.strip().lower() == value_norm or e.normalized_value.strip().lower() == value_norm:
                return e.normalized_value
        return None
