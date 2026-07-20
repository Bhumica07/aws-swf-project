import logging
import random

import aioboto3

from app.config import settings

logger = logging.getLogger(__name__)
session = aioboto3.Session()

SIMULATED_RESPONSES = [
    "Yes, I confirm",
    "No, please reschedule",
    "Can you repeat that?",
    "One",
    "Two",
]


async def transcribe_audio(audio_bytes: bytes, language_code: str = "en-US") -> str:
    """Transcribe audio bytes to text. In simulation mode, returns a random response."""
    if settings.simulate_aws:
        response = random.choice(SIMULATED_RESPONSES)
        logger.info(f"[SIMULATED TRANSCRIBE] Result: '{response}'")
        return response

    # For real implementation, use Amazon Transcribe Streaming
    # This is a simplified version using the batch API
    async with session.client("transcribe", region_name=settings.aws_region) as transcribe:
        import uuid
        job_name = f"voice-node-{uuid.uuid4().hex[:8]}"

        # In production, you'd use the streaming API for real-time transcription
        # For now, log that we'd process this
        logger.info(f"[TRANSCRIBE] Would start streaming job {job_name} for {len(audio_bytes)} bytes")
        return ""


async def simulate_dtmf_input(dtmf_actions: dict) -> str | None:
    """Simulate DTMF input from caller. Returns the digit pressed or None for timeout."""
    if not dtmf_actions:
        return None

    available_digits = list(dtmf_actions.keys())
    # 80% chance of pressing a valid digit, 20% chance of no response (timeout)
    if random.random() < 0.8:
        digit = random.choice(available_digits)
        logger.info(f"[SIMULATED DTMF] Caller pressed: {digit}")
        return digit
    else:
        logger.info("[SIMULATED DTMF] No response (timeout)")
        return None
