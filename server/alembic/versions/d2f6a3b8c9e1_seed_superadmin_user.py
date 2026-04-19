"""seed superadmin user

Revision ID: d2f6a3b8c9e1
Revises: c1e5f2a3b4d7
Create Date: 2026-04-19

"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd2f6a3b8c9e1'
down_revision: Union[str, None] = 'c1e5f2a3b4d7'
branch_labels = None
depends_on = None

SUPERADMIN_EMAIL = "ramees@lokam.ai"
SUPERADMIN_NAME  = "Ramees"

# bcrypt hash of the literal string "admin" — change via /change-password after first login
DEFAULT_PASSWORD_HASH = (
    "$2b$12$fgI9UyLDL4NvRS7jVfv8oOuwrlTclW0bl3YQTYc5bzQUa6DsOGl1O"
)


def upgrade() -> None:
    """Insert the default superadmin account if it does not already exist."""
    op.execute(
        sa.text("""
            INSERT INTO users (email, password_hash, name, role, is_active, must_change_password,
                               created_at, updated_at)
            VALUES (
                :email, :password_hash, :name, 'superadmin', TRUE, TRUE,
                NOW(), NOW()
            )
            ON CONFLICT (email) DO NOTHING
        """).bindparams(
            email=SUPERADMIN_EMAIL,
            password_hash=DEFAULT_PASSWORD_HASH,
            name=SUPERADMIN_NAME,
        )
    )


def downgrade() -> None:
    """Remove the seeded superadmin account."""
    op.execute(
        sa.text("DELETE FROM users WHERE email = :email").bindparams(email=SUPERADMIN_EMAIL)
    )
