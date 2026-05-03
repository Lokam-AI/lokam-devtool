import uuid

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.thread import PresignResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])

PRESIGN_EXPIRES_SECONDS = 300
ALLOWED_MIME_PREFIXES = ("image/",)


class PresignRequest(BaseModel):
    """Payload for requesting a pre-signed S3 upload URL."""

    filename: str
    mime_type: str


@router.post("/presign", response_model=PresignResponse)
async def presign_upload(
    body: PresignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PresignResponse:
    """Return a pre-signed S3 PUT URL so the client can upload directly to S3."""
    if not any(body.mime_type.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
        raise HTTPException(status_code=415, detail="Only image uploads are supported")
    if not settings.AWS_S3_BUCKET:
        raise HTTPException(status_code=503, detail="File uploads are not configured")

    ext = body.filename.rsplit(".", 1)[-1] if "." in body.filename else ""
    key = f"thread-attachments/{uuid.uuid4()}.{ext}" if ext else f"thread-attachments/{uuid.uuid4()}"

    try:
        s3 = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        upload_url: str = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.AWS_S3_BUCKET, "Key": key, "ContentType": body.mime_type},
            ExpiresIn=PRESIGN_EXPIRES_SECONDS,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(status_code=502, detail="Could not generate upload URL") from exc

    public_url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
    return PresignResponse(upload_url=upload_url, key=key, public_url=public_url)
