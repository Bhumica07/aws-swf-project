import time

from fastapi import APIRouter

from app.config import settings
from app.models.schemas import HealthResponse, MetricsResponse
from app.services.call_manager import get_active_calls, get_metrics
from app.worker import is_draining

router = APIRouter()

_start_time = time.time()


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        node_id=settings.node_id,
        status="draining" if is_draining() else "healthy",
        active_calls=len(get_active_calls()),
        uptime_seconds=round(time.time() - _start_time, 1),
    )


@router.get("/metrics", response_model=MetricsResponse)
async def metrics():
    m = get_metrics()
    return MetricsResponse(**m)
