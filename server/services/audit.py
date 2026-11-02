from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from server.core.security import Principal
from server.db.models import AuditLog


async def audit(
    session: AsyncSession, principal: Principal, action: str, target: str | None, detail: dict[str, Any] | None = None
) -> None:
    """Append an immutable audit record (committed with the caller's transaction)."""
    session.add(AuditLog(org_id=principal.org_id, actor=principal.subject, action=action, target=target, detail=detail))
