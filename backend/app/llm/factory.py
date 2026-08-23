"""
Env-driven LLM provider selection. Checks MOCK_LLM first (default true,
knowledge-base/TECH_STACK.md §3/§5) before LLM_PROVIDER/LLM_MODEL --
real provider selection is only reached when MOCK_LLM=false.
"""

from app.config import Settings
from app.llm.base import BaseLLMProvider, LLMProviderError
from app.llm.mock_provider import MockLLMProvider


def build_llm_provider(settings: Settings) -> BaseLLMProvider:
    if settings.mock_llm:
        return MockLLMProvider(latency_seconds=settings.mock_llm_latency_seconds)

    if settings.llm_provider == "gemini":
        from app.llm.gemini_provider import GeminiProvider

        return GeminiProvider(api_key=settings.gemini_api_key or "", model=settings.llm_model)

    if settings.llm_provider == "anthropic":
        raise LLMProviderError(
            "LLM_PROVIDER=anthropic adapter not yet implemented. "
            "Set MOCK_LLM=true or LLM_PROVIDER=gemini."
        )

    if settings.llm_provider == "openai":
        raise LLMProviderError(
            "LLM_PROVIDER=openai adapter not yet implemented. "
            "Set MOCK_LLM=true or LLM_PROVIDER=gemini."
        )

    raise LLMProviderError(f"Unknown LLM_PROVIDER: {settings.llm_provider!r}")
