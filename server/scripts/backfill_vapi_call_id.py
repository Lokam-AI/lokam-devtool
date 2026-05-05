"""One-shot script: backfill vapi_call_id from lokamspace DB into devtool raw_calls."""
import asyncio
import os

import asyncpg

DEVTOOL_DSN_TEMPLATE = (
    "postgresql://{user}:{password}@{host}:{port}/{name}?sslmode=require"
)

_REQUIRED_DEVTOOL_VARS = ("DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT", "DB_NAME")


def _get_lokamspace_dsn() -> str:
    """Read LOKAMSPACE_DSN from environment; raise clearly if missing."""
    dsn = os.environ.get("LOKAMSPACE_DSN")
    if not dsn:
        raise RuntimeError(
            "LOKAMSPACE_DSN env var not set. "
            "Set it to the lokamspace DB connection string before running."
        )
    return dsn


def _build_devtool_dsn() -> str:
    """Build devtool DSN directly from env vars — avoids importing full app config."""
    missing = [v for v in _REQUIRED_DEVTOOL_VARS if not os.environ.get(v)]
    if missing:
        raise RuntimeError(f"Missing env vars for devtool DB: {', '.join(missing)}")
    return DEVTOOL_DSN_TEMPLATE.format(
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ["DB_HOST"],
        port=os.environ["DB_PORT"],
        name=os.environ["DB_NAME"],
    )


async def backfill() -> None:
    """Fetch vapi_call_id values from lokamspace and update devtool raw_calls."""
    devtool_dsn = _build_devtool_dsn()
    lokamspace_dsn = _get_lokamspace_dsn()

    # Get all lokam_call_ids present in devtool
    devtool_conn = await asyncpg.connect(devtool_dsn)
    devtool_ids = [row["lokam_call_id"] for row in await devtool_conn.fetch(
        "SELECT lokam_call_id FROM raw_calls WHERE vapi_call_id IS NULL"
    )]
    print(f"Devtool rows missing vapi_call_id: {len(devtool_ids)}")

    if not devtool_ids:
        print("Nothing to backfill.")
        await devtool_conn.close()
        return

    # Fetch vapi_call_id from lokamspace for those IDs
    lokamspace_conn = await asyncpg.connect(lokamspace_dsn)
    rows = await lokamspace_conn.fetch(
        "SELECT id, vapi_call_id FROM calls WHERE id = ANY($1) AND vapi_call_id IS NOT NULL",
        devtool_ids,
    )
    await lokamspace_conn.close()

    print(f"Lokamspace rows with vapi_call_id: {len(rows)}")

    if not rows:
        print("No vapi_call_id values found in lokamspace for these call IDs.")
        await devtool_conn.close()
        return

    # Bulk update devtool
    await devtool_conn.executemany(
        "UPDATE raw_calls SET vapi_call_id = $1 WHERE lokam_call_id = $2",
        [(row["vapi_call_id"], row["id"]) for row in rows],
    )
    await devtool_conn.close()

    # Verify
    verify_conn = await asyncpg.connect(devtool_dsn)
    count = await verify_conn.fetchval("SELECT COUNT(*) FROM raw_calls WHERE vapi_call_id IS NOT NULL")
    total = await verify_conn.fetchval("SELECT COUNT(*) FROM raw_calls")
    await verify_conn.close()
    print(f"\nDone. {count}/{total} raw_calls now have vapi_call_id.")


if __name__ == "__main__":
    asyncio.run(backfill())
