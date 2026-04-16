from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.exceptions import AppError, AuthError, ConflictError, NotFoundError, PermissionDeniedError


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Run startup/shutdown logic around the application lifecycle."""
    yield


app = FastAPI(
    title="Lokam DevTool API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    """Return 404 for NotFoundError domain exceptions."""
    return JSONResponse(status_code=404, content={"detail": exc.message})


@app.exception_handler(AuthError)
async def auth_error_handler(request: Request, exc: AuthError) -> JSONResponse:
    """Return 401 for AuthError domain exceptions."""
    return JSONResponse(status_code=401, content={"detail": exc.message})


@app.exception_handler(PermissionDeniedError)
async def permission_error_handler(request: Request, exc: PermissionDeniedError) -> JSONResponse:
    """Return 403 for PermissionDeniedError domain exceptions."""
    return JSONResponse(status_code=403, content={"detail": exc.message})


@app.exception_handler(ConflictError)
async def conflict_error_handler(request: Request, exc: ConflictError) -> JSONResponse:
    """Return 409 for ConflictError domain exceptions."""
    return JSONResponse(status_code=409, content={"detail": exc.message})


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Return 400 for any other unhandled AppError subclasses."""
    return JSONResponse(status_code=400, content={"detail": exc.message})
