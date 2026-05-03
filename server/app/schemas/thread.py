from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


class AttachmentRead(BaseModel):
    """Schema for a message attachment (image stored on S3)."""

    url: str
    key: str
    name: str
    mime_type: str
    size_bytes: int


class MessageRead(BaseModel):
    """Schema for returning a message to API consumers."""

    model_config = {"from_attributes": True}

    id: int
    thread_id: int
    user_id: int
    user_name: str
    body: str | None
    created_at: datetime
    edited_at: datetime | None
    deleted_at: datetime | None
    attachments: list[Any] = []


class MessageCreate(BaseModel):
    """Payload for posting a new message to a thread."""

    body: str
    attachments: list[AttachmentRead] = []

    @field_validator("body")
    @classmethod
    def body_not_empty(cls, v: str) -> str:
        """Reject blank bodies."""
        if not v.strip():
            raise ValueError("body must not be blank")
        return v


class MessageUpdate(BaseModel):
    """Payload for editing an existing message body."""

    body: str

    @field_validator("body")
    @classmethod
    def body_not_empty(cls, v: str) -> str:
        """Reject blank bodies."""
        if not v.strip():
            raise ValueError("body must not be blank")
        return v


class ThreadRead(BaseModel):
    """Schema for returning a thread with its messages."""

    model_config = {"from_attributes": True}

    id: int
    messages: list[MessageRead]


class NotificationRead(BaseModel):
    """Schema for returning a notification to the current user."""

    model_config = {"from_attributes": True}

    id: int
    type: str
    message_id: int
    thread_id: int
    entity_type: str | None
    entity_id: int | None
    excerpt: str | None
    is_read: bool
    created_at: datetime


class PresignResponse(BaseModel):
    """Response from the presign endpoint containing S3 upload details."""

    upload_url: str
    key: str
    public_url: str
