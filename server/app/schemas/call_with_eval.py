from pydantic import BaseModel

from app.schemas.eval import EvalRead
from app.schemas.raw_call import RawCallRead


class CallWithEvalRead(BaseModel):
    """Combined schema for a raw call paired with its evaluation record."""

    call: RawCallRead
    eval: EvalRead
