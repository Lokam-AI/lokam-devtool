"""add threads messages and notifications tables

Revision ID: g5h9i2j3k4l5
Revises: add_post_call_sms_cols
Create Date: 2026-05-03 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "g5h9i2j3k4l5"
down_revision: Union[str, None] = "add_post_call_sms_cols"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create threads, messages, thread_participants, and notifications tables."""
    op.execute("""
        CREATE TABLE IF NOT EXISTS threads (
            id SERIAL NOT NULL,
            kind VARCHAR(50) NOT NULL,
            entity_type VARCHAR(100),
            entity_id INTEGER,
            title VARCHAR(255),
            created_by INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            PRIMARY KEY (id)
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_threads_entity ON threads (entity_type, entity_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL NOT NULL,
            thread_id INTEGER NOT NULL REFERENCES threads(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            body TEXT,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            edited_at TIMESTAMP WITHOUT TIME ZONE,
            deleted_at TIMESTAMP WITHOUT TIME ZONE,
            attachments JSONB DEFAULT '[]',
            PRIMARY KEY (id)
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS thread_participants (
            id SERIAL NOT NULL,
            thread_id INTEGER NOT NULL REFERENCES threads(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            last_read_at TIMESTAMP WITHOUT TIME ZONE,
            joined_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            PRIMARY KEY (id)
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_thread_participants_thread_user
        ON thread_participants (thread_id, user_id)
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL NOT NULL,
            recipient_id INTEGER NOT NULL REFERENCES users(id),
            type VARCHAR(50) NOT NULL,
            message_id INTEGER NOT NULL REFERENCES messages(id),
            thread_id INTEGER NOT NULL REFERENCES threads(id),
            entity_type VARCHAR(100),
            entity_id INTEGER,
            excerpt VARCHAR(140),
            is_read BOOLEAN DEFAULT false NOT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            PRIMARY KEY (id)
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
        ON notifications (recipient_id, is_read, created_at)
    """)


def downgrade() -> None:
    """Drop threads, messages, thread_participants, and notifications tables."""
    op.execute("DROP INDEX IF EXISTS idx_notifications_recipient_unread")
    op.execute("DROP TABLE IF EXISTS notifications")
    op.execute("DROP INDEX IF EXISTS idx_thread_participants_thread_user")
    op.execute("DROP TABLE IF EXISTS thread_participants")
    op.execute("DROP INDEX IF EXISTS idx_messages_thread_id")
    op.execute("DROP TABLE IF EXISTS messages")
    op.execute("DROP INDEX IF EXISTS idx_threads_entity")
    op.execute("DROP TABLE IF EXISTS threads")
