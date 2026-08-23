# CrateSense

AI-powered product content enrichment for industrial commerce.

## Run locally

```bash
cp .env.example .env
# fill in GEMINI_API_KEY (or leave MOCK_LLM=true to skip real API calls)
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Stack

- **Backend:** FastAPI + LangGraph pipeline, SQLite (`backend/`)
- **Frontend:** Next.js + shadcn/ui (`frontend/`)
