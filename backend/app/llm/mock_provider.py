"""
MockLLMProvider -- returns pre-baked, hand-authored structured responses
instead of calling a real API. Selected via MOCK_LLM=true (default), see
knowledge-base/TECH_STACK.md §3.

Callers are expected to include the row's Mfg_Part_Num in each prompt
(e.g. "row_id: PDSH4816AF\n...") so the mock provider can look up the
matching dummy response. Unknown row ids fall back to a generic
placeholder response rather than raising, so pipeline-shape testing
against arbitrary Sample-1000 rows doesn't require pre-authoring every
row -- the dummy dataset grows incrementally per knowledge-base/TECH_STACK.md §3.

Optionally simulates real LLM latency via MOCK_LLM_LATENCY_SECONDS
(default 0, i.e. instant) -- useful for exercising batch/concurrency
behavior and SSE progress realistically without waiting on a real
provider. Applied once per generate_structured_batch call (matching one
real batched API round-trip, per knowledge-base/BACKEND_COGNITIVE_FLOW.md
§1), not per individual row.
"""

import asyncio
import json
import re
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

from app.llm.base import BaseLLMProvider, LLMProviderError

SchemaT = TypeVar("SchemaT", bound=BaseModel)

_MOCK_DATA_DIR = Path(__file__).parent / "mock_data"
_ROW_ID_RE = re.compile(r"row_id:\s*(\S+)")


def _load_json(filename: str) -> dict:
    path = _MOCK_DATA_DIR / filename
    if not path.exists():
        return {}
    return json.loads(path.read_text())


class MockLLMProvider(BaseLLMProvider):
    def __init__(self, latency_seconds: float = 0.0):
        self._attribute_data = _load_json("attribute_extraction.json")
        self._description_data = _load_json("description_generation.json")
        self._latency_seconds = latency_seconds

    @staticmethod
    def _extract_row_id(prompt: str) -> str | None:
        match = _ROW_ID_RE.search(prompt)
        return match.group(1) if match else None

    def _lookup(self, row_id: str | None, schema_name: str) -> dict | None:
        if row_id is None:
            return None
        if schema_name == "AttributeExtractionResult":
            return self._attribute_data.get(row_id)
        if schema_name == "DescriptionGenerationResult":
            return self._description_data.get(row_id)
        return None

    def _fallback(self, row_id: str | None, schema: type[SchemaT]) -> dict:
        row_id = row_id or "UNKNOWN"
        if schema.__name__ == "AttributeExtractionResult":
            return {"row_id": row_id, "attributes": []}
        if schema.__name__ == "DescriptionGenerationResult":
            return {
                "row_id": row_id,
                "descriptions": {
                    "invoice_desc": f"MOCK ITEM {row_id}"[:40],
                    "mobile_desc": f"Mock description for {row_id}",
                    "short_desc": f"Mock Short Description {row_id}",
                    "long_desc": f"Mock long description placeholder for row {row_id}.",
                    "retail_desc": f"Mock Retail Description {row_id}",
                    "marketing_description": f"Mock marketing copy for {row_id}.",
                },
            }
        raise LLMProviderError(
            f"MockLLMProvider has no fallback for schema {schema.__name__}. "
            f"Add a case in mock_provider.py or pre-bake a response in llm/mock_data/."
        )

    def _build(self, prompt: str, schema: type[SchemaT]) -> SchemaT:
        row_id = self._extract_row_id(prompt)
        data = self._lookup(row_id, schema.__name__) or self._fallback(row_id, schema)
        return schema.model_validate(data)

    async def generate_structured(self, prompt: str, schema: type[SchemaT], **kwargs) -> SchemaT:
        if self._latency_seconds > 0:
            await asyncio.sleep(self._latency_seconds)
        return self._build(prompt, schema)

    async def generate_structured_batch(
        self, prompts: list[str], schema: type[SchemaT], **kwargs
    ) -> list[SchemaT]:
        # One simulated round-trip per batch call, not per row -- matches
        # a real batched API call's latency profile.
        if self._latency_seconds > 0:
            await asyncio.sleep(self._latency_seconds)
        return [self._build(p, schema) for p in prompts]
