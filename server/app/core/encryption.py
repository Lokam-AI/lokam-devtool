from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.exceptions import ValidationError

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    """Return the singleton Fernet instance, initialising it on first call."""
    global _fernet
    if _fernet is None:
        if not settings.FERNET_KEY:
            raise ValidationError("FERNET_KEY is not configured")
        _fernet = Fernet(settings.FERNET_KEY.encode())
    return _fernet


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a plaintext secret and return a URL-safe base64 ciphertext string."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    """Decrypt a Fernet ciphertext and return the original plaintext string."""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValidationError("Failed to decrypt secret: invalid token") from exc
