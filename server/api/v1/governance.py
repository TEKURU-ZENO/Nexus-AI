from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from server.api.deps import ContainerDep, PrincipalDep, SessionDep
from server.core.security import Permission
from server.db.models import AuditLog, Run
from server.schemas.api import AuditEntry, CalibrationBucket, CalibrationReport, MemoryItem
from server.services.audit import audit

router = APIRouter(tags=["governance"])


@router.get("/memory", response_model=list[MemoryItem])
async def list_memory(
    principal: PrincipalDep, session: SessionDep, container: ContainerDep, project: str | None = None
) -> list[MemoryItem]:
    principal.require(Permission.MEMORY_READ)
    return [MemoryItem.model_validate(m) for m in await container.memory.list(session, principal.org_id, project)]


@router.delete("/memory/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(memory_id: str, principal: PrincipalDep, session: SessionDep, container: ContainerDep) -> None:
    principal.require(Permission.MEMORY_DELETE)
    if not await container.memory.delete(session, principal.org_id, memory_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "memory not found")
    await audit(session, principal, "memory.delete", memory_id)
    await session.commit()


@router.get("/audit", response_model=list[AuditEntry])
async def list_audit(
    principal: PrincipalDep, session: SessionDep, limit: Annotated[int, Query(ge=1, le=500)] = 100
) -> list[AuditEntry]:
    principal.require(Permission.AUDIT_READ)
    rows = (
        await session.scalars(
            select(AuditLog)
            .where(AuditLog.org_id == principal.org_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
    ).all()
    return [AuditEntry.model_validate(r) for r in rows]


@router.get("/calibration", response_model=CalibrationReport)
async def calibration(principal: PrincipalDep, session: SessionDep) -> CalibrationReport:
    """Compare predicted confidence with human acceptance (accepted vs rejected/challenged)."""
    principal.require(Permission.RUN_READ)
    rows = (
        await session.execute(
            select(Run.confidence, Run.decision_status).where(
                Run.org_id == principal.org_id,
                Run.confidence.is_not(None),
                Run.simulated.is_(False),
                Run.decision_status.in_(["accepted", "rejected", "challenged"]),
            )
        )
    ).all()
    buckets: list[CalibrationBucket] = []
    ece, total = 0.0, len(rows)
    for lo in range(0, 100, 20):
        hi = lo + 20
        sel = [r for r in rows if lo <= int(r[0] or 0) < hi or (hi == 100 and int(r[0] or 0) == 100)]
        acc = sum(1 for r in sel if r[1] == "accepted")
        rate = acc / len(sel) if sel else None
        if sel and rate is not None:
            mean_conf = sum(int(r[0] or 0) for r in sel) / len(sel) / 100
            ece += len(sel) / total * abs(rate - mean_conf)
        buckets.append(CalibrationBucket(bucket=f"{lo}-{hi}", runs=len(sel), accepted=acc, acceptance_rate=rate))
    return CalibrationReport(
        buckets=buckets, expected_calibration_error=round(ece, 4) if total else None, decided_runs=total
    )
