import time
import uuid
from typing import Any

import aioboto3
from boto3.dynamodb.conditions import Attr, Key

from app.config import settings
from app.models.schemas import CallStatus, CallTask, CallTaskCreate


session = aioboto3.Session()


def _get_resource_kwargs() -> dict[str, Any]:
    kwargs: dict[str, Any] = {"region_name": settings.aws_region}
    if settings.dynamodb_endpoint:
        kwargs["endpoint_url"] = settings.dynamodb_endpoint
    return kwargs


async def create_table_if_not_exists():
    async with session.resource("dynamodb", **_get_resource_kwargs()) as dynamodb:
        existing = [t.name async for t in dynamodb.tables.all()]
        if settings.dynamodb_table in existing:
            return

        await dynamodb.create_table(
            TableName=settings.dynamodb_table,
            KeySchema=[{"AttributeName": "task_id", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "task_id", "AttributeType": "S"},
                {"AttributeName": "status", "AttributeType": "S"},
                {"AttributeName": "claimed_at", "AttributeType": "N"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "status-index",
                    "KeySchema": [
                        {"AttributeName": "status", "KeyType": "HASH"},
                        {"AttributeName": "claimed_at", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                    "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
                }
            ],
            ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
        )


async def put_call_task(task_create: CallTaskCreate) -> CallTask:
    task = CallTask(
        task_id=uuid.uuid4().hex,
        order_id=task_create.order_id,
        step=task_create.step,
        phone_number=task_create.phone_number,
        message=task_create.message,
        dtmf_actions=task_create.dtmf_actions,
    )

    async with session.resource("dynamodb", **_get_resource_kwargs()) as dynamodb:
        table = await dynamodb.Table(settings.dynamodb_table)
        item = task.model_dump()
        item["dtmf_actions"] = {k: v.model_dump() for k, v in task.dtmf_actions.items()}
        # DynamoDB doesn't support None in sets; remove None values
        item = {k: v for k, v in item.items() if v is not None}
        await table.put_item(Item=item)

    return task


async def claim_pending_task() -> CallTask | None:
    """Claim one pending_call task atomically using conditional update."""
    async with session.resource("dynamodb", **_get_resource_kwargs()) as dynamodb:
        table = await dynamodb.Table(settings.dynamodb_table)

        response = await table.query(
            IndexName="status-index",
            KeyConditionExpression=Key("status").eq(CallStatus.PENDING_CALL.value),
            Limit=1,
        )

        items = response.get("Items", [])
        if not items:
            return None

        item = items[0]
        now = time.time()

        try:
            await table.update_item(
                Key={"task_id": item["task_id"]},
                UpdateExpression="SET #s = :new_status, node_id = :node, claimed_at = :now, attempt_count = attempt_count + :inc",
                ConditionExpression=Attr("status").eq(CallStatus.PENDING_CALL.value),
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":new_status": CallStatus.IN_PROGRESS.value,
                    ":node": settings.node_id,
                    ":now": int(now),
                    ":inc": 1,
                },
            )
        except Exception:
            return None

        item["status"] = CallStatus.IN_PROGRESS.value
        item["node_id"] = settings.node_id
        item["claimed_at"] = now
        return _item_to_task(item)


async def reclaim_stale_tasks() -> list[CallTask]:
    """Find in_progress tasks with expired leases and reclaim them."""
    cutoff = int(time.time()) - settings.lease_timeout_seconds

    async with session.resource("dynamodb", **_get_resource_kwargs()) as dynamodb:
        table = await dynamodb.Table(settings.dynamodb_table)

        response = await table.query(
            IndexName="status-index",
            KeyConditionExpression=Key("status").eq(CallStatus.IN_PROGRESS.value) & Key("claimed_at").lt(cutoff),
        )

        reclaimed = []
        for item in response.get("Items", []):
            if item.get("node_id") == settings.node_id:
                continue

            now = time.time()
            try:
                await table.update_item(
                    Key={"task_id": item["task_id"]},
                    UpdateExpression="SET node_id = :node, claimed_at = :now, attempt_count = attempt_count + :inc",
                    ConditionExpression=Attr("node_id").eq(item["node_id"]),
                    ExpressionAttributeValues={
                        ":node": settings.node_id,
                        ":now": int(now),
                        ":inc": 1,
                    },
                )
                item["node_id"] = settings.node_id
                item["claimed_at"] = now
                reclaimed.append(_item_to_task(item))
            except Exception:
                continue

        return reclaimed


async def mark_informed(task_id: str):
    from datetime import datetime

    async with session.resource("dynamodb", **_get_resource_kwargs()) as dynamodb:
        table = await dynamodb.Table(settings.dynamodb_table)
        await table.update_item(
            Key={"task_id": task_id},
            UpdateExpression="SET #s = :status, completed_at = :now",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":status": CallStatus.INFORMED.value,
                ":now": datetime.utcnow().isoformat(),
            },
        )


async def mark_failed(task_id: str):
    async with session.resource("dynamodb", **_get_resource_kwargs()) as dynamodb:
        table = await dynamodb.Table(settings.dynamodb_table)
        await table.update_item(
            Key={"task_id": task_id},
            UpdateExpression="SET #s = :status",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":status": CallStatus.FAILED.value},
        )


async def release_task(task_id: str):
    """Release a task back to pending_call (used during drain)."""
    async with session.resource("dynamodb", **_get_resource_kwargs()) as dynamodb:
        table = await dynamodb.Table(settings.dynamodb_table)
        await table.update_item(
            Key={"task_id": task_id},
            UpdateExpression="SET #s = :status REMOVE node_id, claimed_at",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":status": CallStatus.PENDING_CALL.value},
        )


async def query_tasks(status: str | None = None, order_id: str | None = None, limit: int = 50) -> list[CallTask]:
    async with session.resource("dynamodb", **_get_resource_kwargs()) as dynamodb:
        table = await dynamodb.Table(settings.dynamodb_table)

        if status:
            response = await table.query(
                IndexName="status-index",
                KeyConditionExpression=Key("status").eq(status),
                Limit=limit,
            )
        else:
            scan_kwargs: dict[str, Any] = {"Limit": limit}
            if order_id:
                scan_kwargs["FilterExpression"] = Attr("order_id").eq(order_id)
            response = await table.scan(**scan_kwargs)

        return [_item_to_task(item) for item in response.get("Items", [])]


def _item_to_task(item: dict) -> CallTask:
    dtmf_raw = item.get("dtmf_actions", {})
    from app.models.schemas import DtmfAction
    dtmf_actions = {}
    for k, v in dtmf_raw.items():
        if isinstance(v, dict):
            dtmf_actions[k] = DtmfAction(**v)
        else:
            dtmf_actions[k] = v

    return CallTask(
        task_id=item["task_id"],
        order_id=item.get("order_id", ""),
        step=item.get("step", ""),
        phone_number=item.get("phone_number", ""),
        message=item.get("message", ""),
        dtmf_actions=dtmf_actions,
        status=item.get("status", CallStatus.PENDING_CALL.value),
        node_id=item.get("node_id"),
        claimed_at=item.get("claimed_at"),
        attempt_count=int(item.get("attempt_count", 0)),
        created_at=item.get("created_at", ""),
        completed_at=item.get("completed_at"),
    )
