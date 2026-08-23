import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, evaluation, jobs, review_queue, rows, stream
from app.config import settings
from app.deps import build_app_resources


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.resources = await build_app_resources(settings)
    app.state.background_tasks = set()
    yield
    # POST /jobs fires run_job as a fire-and-forget asyncio task
    # (api/jobs.py) so the request doesn't block on completion. Without
    # waiting for in-flight tasks here, a still-running job can still be
    # writing to the DB via app.state.resources.db_engine after it's
    # disposed below -- surfaced as a StaticPool "KeyError: 'connection'"
    # under fast, back-to-back test runs (each test's LifespanManager
    # tears down before the previous test's background task truly finished).
    if app.state.background_tasks:
        await asyncio.gather(*app.state.background_tasks, return_exceptions=True)
    await app.state.resources.db_engine.dispose()


app = FastAPI(title="CrateSense API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rows.router)
app.include_router(jobs.router)
app.include_router(stream.router)
app.include_router(auth.router)
app.include_router(evaluation.router)
app.include_router(review_queue.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
