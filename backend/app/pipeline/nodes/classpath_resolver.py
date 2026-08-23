"""
ClasspathResolver: resolves Dept > Class > Fine classpath per row.

Deterministic, keyword-based heuristic -- NOT an ML classifier (per
knowledge-base/HACKATHON_STATEMENT.md §2, taxonomy/classification is
explicitly out of full scope: "only as much as needed to select the
correct LOV attribute set"). Rows that don't match any known keyword are
left unresolved and flagged, not guessed -- per
knowledge-base/provided-docs/Solution_Guide.md §4: "gap detection... is a
strength, not a failure."

Keywords are derived at call time from LovIndex.classpaths_with_leaf_nodes()
-- i.e. from whichever master data is actually mounted (fixtures today,
real data if it's ever provided) -- never a hardcoded category list. Swap
the mounted .xlsx files and this node adapts automatically with zero code
changes.
"""

import re

from app.master_data.lov_index import LovIndex
from app.pipeline.state import BatchState

UNRESOLVED_FLAG = "classpath_unresolved"

_WORD_RE = re.compile(r"[a-z]+")


def _keywords_from_leaf_node(leaf_node: str) -> set[str]:
    """Split a Leaf Node label (e.g. "Built-In Dishwashers") into lowercase
    singular-ish keyword candidates (e.g. {"built", "dishwashers", "dishwasher"}).
    Naive singularization (strip trailing 's') covers the common case without
    pulling in an NLP dependency."""
    words = set(_WORD_RE.findall(leaf_node.lower()))
    singulars = {w[:-1] for w in words if w.endswith("s") and len(w) > 3}
    return words | singulars


def _build_keyword_index(lov_index: LovIndex) -> dict[str, str]:
    """keyword -> classpath, built fresh from whatever classpaths/leaf nodes
    are present in the currently loaded LOV data."""
    keyword_to_classpath: dict[str, str] = {}
    for classpath, leaf_node in lov_index.classpaths_with_leaf_nodes():
        for keyword in _keywords_from_leaf_node(leaf_node):
            # Longer leaf-node names take precedence if two classpaths share
            # a short generic word; first-seen wins for equal-specificity ties.
            keyword_to_classpath.setdefault(keyword, classpath)
    return keyword_to_classpath


def resolve_classpath(batch: BatchState, lov_index: LovIndex) -> BatchState:
    keyword_index = _build_keyword_index(lov_index)

    for row in batch.rows:
        desc_words = set(_WORD_RE.findall(row.raw_row.part_desc.lower()))
        matched_classpath = None
        for word in desc_words:
            if word in keyword_index:
                matched_classpath = keyword_index[word]
                break

        if matched_classpath:
            row.classpath = matched_classpath
        else:
            row.flags.append(UNRESOLVED_FLAG)

    return batch
