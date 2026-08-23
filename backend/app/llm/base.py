"""
Provider-agnostic LLM abstraction (knowledge-base/TECH_STACK.md §3).

Every LangGraph node that calls an LLM (AttributeExtractor, DescriptionBuilder,
AttributeAuditor, DescriptionAuditor) depends only on BaseLLMProvider, never a
vendor SDK directly -- so swapping providers, or swapping to MockLLMProvider
for MOCK_LLM=true dev runs, requires no node code changes.

Batch-shaped per knowledge-base/BACKEND_COGNITIVE_FLOW.md: one call handles
BATCH_SIZE rows/prompts at once, returning one structured result per prompt.
"""

from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class LLMProviderError(RuntimeError):
    """Raised when a provider fails to produce a schema-conformant response."""


class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate_structured(self, prompt: str, schema: type[SchemaT], **kwargs) -> SchemaT:
        """Single prompt -> single schema-conformant structured response."""
        raise NotImplementedError

    @abstractmethod
    async def generate_structured_batch(
        self, prompts: list[str], schema: type[SchemaT], **kwargs
    ) -> list[SchemaT]:
        """Multiple prompts (one per row in a batch) -> one structured response
        per prompt, same order as input. A batch/sub-batch LLM call per
        knowledge-base/BACKEND_COGNITIVE_FLOW.md §1."""
        raise NotImplementedError
