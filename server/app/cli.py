"""CLI for bootstrapping the Lokam DevTool application."""
import asyncio
import sys

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.repositories import env_config_repo, user_repo

DEFAULT_ENVS = [
    {"name": "dev", "base_url": "http://localhost:8001", "secrets": {}, "is_active": True},
    {"name": "staging", "base_url": "https://staging.lokamspace.com", "secrets": {}, "is_active": True},
    {"name": "prod", "base_url": "https://app.lokamspace.com", "secrets": {}, "is_active": True},
]


def _parse_args() -> tuple[str, str, str]:
    """Parse --email, --name, --password from sys.argv; exit on error."""
    args = sys.argv[1:]
    params: dict[str, str] = {}
    i = 0
    while i < len(args):
        if args[i].startswith("--") and i + 1 < len(args):
            key = args[i].lstrip("-")
            params[key] = args[i + 1]
            i += 2
        else:
            i += 1

    required = ("email", "name", "password")
    missing = [r for r in required if r not in params]
    if missing:
        print(f"Usage: python -m app.cli create-superadmin --email <email> --name <name> --password <password>")
        print(f"Missing: {', '.join(missing)}")
        sys.exit(1)

    return params["email"], params["name"], params["password"]


async def _create_superadmin(db: AsyncSession, email: str, name: str, password: str) -> None:
    """Create a superadmin user if one with the given email does not already exist."""
    existing = await user_repo.get_by_email(db, email)
    if existing is not None:
        print(f"User with email '{email}' already exists.")
        return

    user = await user_repo.create(
        db,
        email=email,
        password_hash=hash_password(password),
        name=name,
        role="superadmin",
    )
    print(f"Created superadmin: {user.email} (id={user.id})")


async def _seed_default_envs(db: AsyncSession) -> None:
    """Create default env_configs if they don't already exist."""
    for env_def in DEFAULT_ENVS:
        existing = await env_config_repo.get_by_name(db, env_def["name"])
        if existing is not None:
            print(f"Env '{env_def['name']}' already exists — skipped")
            continue
        env = await env_config_repo.create(db, **env_def)
        print(f"Created env config: {env.name} → {env.base_url}")


async def _run(email: str, name: str, password: str) -> None:
    """Run superadmin creation and env seeding in a single transaction."""
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await _create_superadmin(session, email, name, password)
            await _seed_default_envs(session)


def main() -> None:
    """Entry point: parse args and run the bootstrap coroutine."""
    if len(sys.argv) < 2 or sys.argv[1] != "create-superadmin":
        print("Usage: python -m app.cli create-superadmin --email <email> --name <name> --password <password>")
        sys.exit(1)

    email, name, password = _parse_args()
    asyncio.run(_run(email, name, password))


if __name__ == "__main__":
    main()
