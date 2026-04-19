from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, bugs, calls, evals, health, stats, sync, team, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(calls.router)
api_router.include_router(evals.router)
api_router.include_router(admin.router)
api_router.include_router(team.router)
api_router.include_router(bugs.router)
api_router.include_router(sync.router)
api_router.include_router(stats.router)
