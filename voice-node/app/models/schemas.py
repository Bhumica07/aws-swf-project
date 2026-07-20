from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class CallStatus(str, Enum):
    PENDING_CALL = "pending_call"
    IN_PROGRESS = "in_progress"
    INFORMED = "informed"
    FAILED = "failed"


class DtmfAction(BaseModel):
    digit: str
    action: str  # e.g. "confirm_received", "reschedule", "speak_to_agent"
    response_message: str | None = None  # What to say if this digit is pressed


class CallTaskCreate(BaseModel):
    order_id: str
    step: str
    phone_number: str
    message: str
    dtmf_actions: dict[str, DtmfAction] = Field(default_factory=dict)


class CallTask(BaseModel):
    task_id: str
    order_id: str
    step: str
    phone_number: str
    message: str
    dtmf_actions: dict[str, DtmfAction] = Field(default_factory=dict)
    status: CallStatus = CallStatus.PENDING_CALL
    node_id: str | None = None
    claimed_at: float | None = None
    attempt_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    completed_at: str | None = None


class CallResponse(BaseModel):
    task_id: str
    status: CallStatus
    message: str


class HealthResponse(BaseModel):
    node_id: str
    status: str  # "healthy" | "draining"
    active_calls: int
    uptime_seconds: float


class MetricsResponse(BaseModel):
    calls_attempted: int
    calls_completed: int
    calls_failed: int
    calls_in_progress: int
    average_duration_seconds: float


class HangupRequest(BaseModel):
    task_id: str


class CallsQueryRequest(BaseModel):
    status: CallStatus | None = None
    order_id: str | None = None
    limit: int = 50
