from pydantic import BaseModel


class TeamMemberStats(BaseModel):
    """Per-reviewer stats returned by the team overview endpoint."""

    id: int
    name: str
    email: str
    role: str
    calls_assigned: int
    calls_pending: int
    completed_total: int
    completed_today: int
    completion_pct: float
    correction_rate: float
    avg_nps: float | None
