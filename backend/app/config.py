from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mock_llm: bool = True
    mock_llm_latency_seconds: float = 0.0
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.5-flash-lite"
    gemini_api_key: str | None = None
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None

    batch_size: int = 5
    concurrency_window: int = 3
    max_node_retries: int = 2

    database_url: str = "sqlite:////data/unihack.db"
    master_data_dir: str = "/data/master"
    provided_docs_dir: str = "/data/provided-docs"
    cors_origins: str = "http://localhost:3000"
    dev_override: bool = False
    # Must match the frontend's GOOGLE_CLIENT_ID -- the id_token audience
    # (aud claim) is checked against this on every verify (AUTH_AND_SECURITY.md §2).
    google_client_id: str | None = None


settings = Settings()
