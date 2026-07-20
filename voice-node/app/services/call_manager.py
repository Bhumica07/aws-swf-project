import asyncio
import logging
import time

from app.models.schemas import CallTask
from app.services import polly, transcribe
from app.services.dynamo import mark_failed, mark_informed

logger = logging.getLogger(__name__)

active_calls: dict[str, CallTask] = {}
metrics = {
    "calls_attempted": 0,
    "calls_completed": 0,
    "calls_failed": 0,
    "total_duration": 0.0,
}


async def execute_call(task: CallTask) -> bool:
    """
    Execute an outbound call for the given task.
    Returns True if call completed successfully (recipient informed).
    """
    active_calls[task.task_id] = task
    metrics["calls_attempted"] += 1
    start_time = time.time()

    try:
        logger.info(f"[CALL] Starting outbound call to {task.phone_number} for order={task.order_id} step={task.step}")

        # Step 1: Synthesize the message via Polly
        audio = await polly.synthesize_speech(task.message)
        logger.info(f"[CALL] TTS ready ({len(audio)} bytes), simulating ring...")

        # Step 2: Simulate ringing and answer
        await asyncio.sleep(2.0)  # Ring time
        logger.info(f"[CALL] Call answered by {task.phone_number}")

        # Step 3: Play the message
        await asyncio.sleep(3.0)  # Message playback time
        logger.info(f"[CALL] Message delivered: '{task.message[:60]}...'")

        # Step 4: Wait for DTMF response
        if task.dtmf_actions:
            logger.info(f"[CALL] Waiting for DTMF input (options: {list(task.dtmf_actions.keys())})")
            await asyncio.sleep(2.0)  # Wait for input

            digit = await transcribe.simulate_dtmf_input(
                {k: v.model_dump() for k, v in task.dtmf_actions.items()}
            )

            if digit and digit in task.dtmf_actions:
                action = task.dtmf_actions[digit]
                logger.info(f"[CALL] DTMF '{digit}' received → action: {action.action}")

                if action.response_message:
                    await polly.synthesize_speech(action.response_message)
                    await asyncio.sleep(2.0)  # Play response
                    logger.info(f"[CALL] Response played: '{action.response_message[:60]}'")
            else:
                logger.info("[CALL] No valid DTMF received, proceeding to end call")

        # Step 5: End call successfully
        logger.info(f"[CALL] Call completed successfully for task={task.task_id}")
        await mark_informed(task.task_id)
        metrics["calls_completed"] += 1
        return True

    except asyncio.CancelledError:
        logger.warning(f"[CALL] Call cancelled (drain) for task={task.task_id}")
        raise
    except Exception as e:
        logger.error(f"[CALL] Call failed for task={task.task_id}: {e}")
        await mark_failed(task.task_id)
        metrics["calls_failed"] += 1
        return False
    finally:
        duration = time.time() - start_time
        metrics["total_duration"] += duration
        active_calls.pop(task.task_id, None)


def get_active_calls() -> list[CallTask]:
    return list(active_calls.values())


def get_metrics() -> dict:
    total = metrics["calls_completed"] + metrics["calls_failed"]
    avg_duration = metrics["total_duration"] / total if total > 0 else 0.0
    return {
        "calls_attempted": metrics["calls_attempted"],
        "calls_completed": metrics["calls_completed"],
        "calls_failed": metrics["calls_failed"],
        "calls_in_progress": len(active_calls),
        "average_duration_seconds": round(avg_duration, 2),
    }
