import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.routers import calls, health
from app.services.dynamo import create_table_if_not_exists
from app.worker import poll_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Voice Node starting: node_id={settings.node_id}")

    # Ensure DynamoDB table exists (useful for local dev with DynamoDB Local)
    await create_table_if_not_exists()

    # Start the background worker that polls for pending call tasks
    worker_task = asyncio.create_task(poll_loop())

    yield

    # Shutdown: cancel worker
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    logger.info("Voice Node shut down complete")


app = FastAPI(
    title="Voice Node Service",
    description="Simulated outbound calling service for plant delivery notifications",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(calls.router)
