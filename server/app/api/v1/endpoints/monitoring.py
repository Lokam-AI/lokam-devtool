from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.dependencies import require_admin
from app.models.user import User
from app.services import monitoring_service

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/services")
async def list_services(_: User = Depends(require_admin)):
    return {"services": monitoring_service.SERVICES, "envs": monitoring_service.ENVS}


@router.get("/query")
async def query_logs(
    services: list[str] = Query(default=[]),
    levels: list[str] = Query(default=[]),
    envs: list[str] = Query(default=["prod"]),
    search: str = Query(default=""),
    hours: int = Query(default=1, ge=1, le=168),
    limit: int = Query(default=200, ge=1, le=1000),
    _: User = Depends(require_admin),
):
    now = datetime.now(timezone.utc)
    end_ns = int(now.timestamp() * 1e9)
    start_ns = int((now - timedelta(hours=hours)).timestamp() * 1e9)

    entries = await monitoring_service.query_logs(
        services=services,
        levels=levels,
        envs=envs,
        start_ns=start_ns,
        end_ns=end_ns,
        search=search,
        limit=limit,
    )
    return entries


@router.get("/count")
async def count_logs(
    envs: list[str] = Query(default=["prod"]),
    hours: int = Query(default=1, ge=1, le=168),
    _: User = Depends(require_admin),
):
    """Return total log count via Loki count_over_time metric query."""
    total = await monitoring_service.count_logs(envs=envs, hours=hours)
    return {"count": total}


@router.get("/stream")
async def stream_logs(
    services: list[str] = Query(default=[]),
    levels: list[str] = Query(default=[]),
    envs: list[str] = Query(default=["prod"]),
    _: User = Depends(require_admin),
):
    return StreamingResponse(
        monitoring_service.stream_logs(services=services, levels=levels, envs=envs),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
