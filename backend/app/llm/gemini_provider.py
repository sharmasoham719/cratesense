"""
Real default LLM adapter (knowledge-base/TECH_STACK.md §3). Only exercised
when MOCK_LLM=false -- the dev-loop default is MockLLMProvider. Kept minimal:
this harness's priority is pipeline shape, not model tuning.
"""

import asyncio
from typing import TypeVar

from google import genai
from pydantic import BaseModel

from app.llm.base import BaseLLMProvider, LLMProviderError

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise LLMProviderError("GEMINI_API_KEY is required when LLM_PROVIDER=gemini and MOCK_LLM=false")
        self._client = genai.Client(api_key=api_key)
        self._model = model

    async def generate_structured(self, prompt: str, schema: type[SchemaT], **kwargs) -> SchemaT:
        response = await asyncio.to_thread(
            self._client.models.generate_content,
            model=self._model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": schema,
            },
        )
        try:
            return schema.model_validate_json(response.text)
        except Exception as exc:
            raise LLMProviderError(f"Gemini response failed schema validation: {exc}") from exc

    async def generate_structured_batch(
        self, prompts: list[str], schema: type[SchemaT], **kwargs
    ) -> list[SchemaT]:
        return await asyncio.gather(
            *(self.generate_structured(p, schema, **kwargs) for p in prompts)
        )
