class AppError(Exception):
    """Base exception for all domain errors in the application."""

    def __init__(self, message: str) -> None:
        """Initialize with a human-readable error message."""
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    """Raised when a requested resource does not exist."""


class AuthError(AppError):
    """Raised when authentication fails or credentials are invalid."""


class PermissionError(AppError):
    """Raised when a user lacks permission to perform an action."""


class ConflictError(AppError):
    """Raised when an operation conflicts with existing state."""


class ValidationError(AppError):
    """Raised when input data fails domain-level validation."""
