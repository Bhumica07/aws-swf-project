import asyncio
import logging

from app.config import settings
from app.services import dynamo
from app.services.call_manager import execute_call

logger = logging.getLogger(__name__)

_draining = False
_active_tasks: set[asyncio.Task] = set()


def is_draining() -> bool:
    return _draining


async def start_drain():
    """Initiate graceful drain. Stop polling, wait for active calls to finish or timeout."""
    global _draining
    _draining = True
    logger.warning(f"[DRAIN] Node {settings.node_id} entering drain mode. Active calls: {len(_active_tasks)}")

    if _active_tasks:
        logger.info(f"[DRAIN] Waiting up to {settings.drain_grace_seconds}s for {len(_active_tasks)} active calls")
        done, pending = await asyncio.wait(_active_tasks, timeout=settings.drain_grace_seconds)

        if pending:
            logger.warning(f"[DRAIN] {len(pending)} calls did not finish in time, cancelling")
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)

            # Release incomplete tasks back to pending so another node picks them up
            from app.services.call_manager import active_calls
            for task_id in list(active_calls.keys()):
                await dynamo.release_task(task_id)
                logger.info(f"[DRAIN] Released task {task_id} back to pending_call")

    logger.info("[DRAIN] Drain complete. Node ready to shut down.")


async def poll_loop():
    """Main polling loop: claim pending tasks and reclaim stale ones."""
    logger.info(f"[WORKER] Starting poll loop on node={settings.node_id}, interval={settings.poll_interval_seconds}s")

    # On startup, try to reclaim stale tasks from dead nodes
    stale_tasks = await dynamo.reclaim_stale_tasks()
    for task in stale_tasks:
        logger.info(f"[WORKER] Reclaimed stale task {task.task_id} (attempt #{task.attempt_count})")
        _spawn_call(task)

    while not _draining:
        try:
            task = await dynamo.claim_pending_task()
            if task:
                logger.info(f"[WORKER] Claimed task {task.task_id} for {task.phone_number}")
                _spawn_call(task)
            else:
                # Also periodically check for stale tasks
                stale = await dynamo.reclaim_stale_tasks()
                for t in stale:
                    logger.info(f"[WORKER] Reclaimed stale task {t.task_id}")
                    _spawn_call(t)
        except Exception as e:
            logger.error(f"[WORKER] Error in poll loop: {e}")

        await asyncio.sleep(settings.poll_interval_seconds)

    logger.info("[WORKER] Poll loop stopped (draining)")


def _spawn_call(call_task):
    """Spawn an async task to execute the call."""
    async_task = asyncio.create_task(execute_call(call_task))
    _active_tasks.add(async_task)
    async_task.add_done_callback(_active_tasks.discard)
