import asyncio

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    CallResponse,
    CallsQueryRequest,
    CallStatus,
    CallTask,
    CallTaskCreate,
    HangupRequest,
)
from app.services import dynamo
from app.services.call_manager import execute_call, get_active_calls
from app.worker import is_draining, start_drain

router = APIRouter()


@router.post("/call", response_model=CallResponse)
async def initiate_call(request: CallTaskCreate):
    """Manually create and immediately execute a call task (for testing)."""
    if is_draining():
        raise HTTPException(status_code=503, detail="Node is draining, cannot accept new calls")

    task = await dynamo.put_call_task(request)

    # Kick off the call in background
    asyncio.create_task(execute_call(task))

    return CallResponse(
        task_id=task.task_id,
        status=CallStatus.IN_PROGRESS,
        message=f"Call initiated to {task.phone_number}",
    )


@router.post("/calls", response_model=list[CallTask])
async def query_calls(request: CallsQueryRequest):
    """Query call tasks by status or order_id."""
    tasks = await dynamo.query_tasks(
        status=request.status.value if request.status else None,
        order_id=request.order_id,
        limit=request.limit,
    )
    return tasks


@router.post("/hangup", response_model=CallResponse)
async def hangup_call(request: HangupRequest):
    """Force-terminate a specific active call."""
    active = get_active_calls()
    target = next((c for c in active if c.task_id == request.task_id), None)

    if not target:
        raise HTTPException(status_code=404, detail=f"No active call with task_id={request.task_id}")

    # Release back to pending so it can be retried
    await dynamo.release_task(request.task_id)

    return CallResponse(
        task_id=request.task_id,
        status=CallStatus.PENDING_CALL,
        message="Call terminated, task released back to pending",
    )


@router.post("/drain")
async def drain_node():
    """Initiate graceful node drain. Stops accepting new calls, waits for active calls."""
    if is_draining():
        return {"status": "already_draining"}

    asyncio.create_task(start_drain())

    return {
        "status": "drain_initiated",
        "active_calls": len(get_active_calls()),
        "message": "Node will stop accepting new calls and shut down after active calls complete",
    }
