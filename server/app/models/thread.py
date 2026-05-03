from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Thread(Base):
    """ORM model for the threads table — one thread per entity (bug, call, eval) or DM/group."""

    __tablename__ = "threads"
    __table_args__ = (
        Index("idx_threads_entity", "entity_type", "entity_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    title: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), nullable=False
    )


class Message(Base):
    """ORM model for the messages table — individual messages within a thread."""

    __tablename__ = "messages"
    __table_args__ = (
        Index("idx_messages_thread_id", "thread_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    thread_id: Mapped[int] = mapped_column(Integer, ForeignKey("threads.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), nullable=False
    )
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    attachments: Mapped[list | None] = mapped_column(JSONB, server_default="[]")


class ThreadParticipant(Base):
    """ORM model for thread_participants — scaffolded for future DM/group chat."""

    __tablename__ = "thread_participants"
    __table_args__ = (
        Index("idx_thread_participants_thread_user", "thread_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    thread_id: Mapped[int] = mapped_column(Integer, ForeignKey("threads.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), nullable=False
    )


class Notification(Base):
    """ORM model for the notifications table — in-app inbox for mentions and future alert types."""

    __tablename__ = "notifications"
    __table_args__ = (
        Index("idx_notifications_recipient_unread", "recipient_id", "is_read", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    recipient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    message_id: Mapped[int] = mapped_column(Integer, ForeignKey("messages.id"), nullable=False)
    thread_id: Mapped[int] = mapped_column(Integer, ForeignKey("threads.id"), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    excerpt: Mapped[str | None] = mapped_column(String(140))
    is_read: Mapped[bool] = mapped_column(server_default="false", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), nullable=False
    )
