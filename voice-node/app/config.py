import os
import uuid

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    aws_region: str = "us-east-1"
    dynamodb_table: str = "call_tasks"
    dynamodb_endpoint: str | None = None  # Override for DynamoDB Local
    simulate_aws: bool = True  # When True, mock Polly/Transcribe responses
    poll_interval_seconds: int = 5
    lease_timeout_seconds: int = 120
    drain_grace_seconds: int = 30
    node_id: str = ""

    class Config:
        env_file = ".env"

    def model_post_init(self, __context):
        if not self.node_id:
            ecs_metadata = os.environ.get("ECS_CONTAINER_METADATA_URI_V4")
            if ecs_metadata:
                self.node_id = os.environ.get("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI", uuid.uuid4().hex[:12])
            else:
                self.node_id = f"local-{uuid.uuid4().hex[:8]}"


settings = Settings()
