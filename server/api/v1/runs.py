from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy import select

from server.api.deps import ContainerDep, PrincipalDep, SessionDep
from server.core.security import Permission, Principal
from server.db.models import Run
from server.schemas.api import (
    DecisionRequest,
    DecisionResponse,
    DecisionStatus,
    MissionMode,
    RunCreate,
    RunDetail,
    RunResult,
    RunStatus,
    RunSummary,
    Usage,
)
from server.services.audit import audit
from server.services.export import directive_markdown

router = APIRouter(prefix="/runs", tags=["runs"])


def _summary(run: Run) -> RunSummary:
    return RunSummary(
        id=run.id,
        mission=run.mission,
        mode=MissionMode(run.mode),
        project=run.project,
        status=RunStatus(run.status),
        decision_status=DecisionStatus(run.decision_status),
        confidence=run.confidence,
        simulated=run.simulated,
        parent_run_id=run.parent_run_id,
        created_at=run.created_at,
        finished_at=run.finished_at,
    )


def _detail(run: Run) -> RunDetail:
    return RunDetail(
        **_summary(run).model_dump(),
        refinement=run.refinement,
        result=RunResult.model_validate(run.result) if run.result else None,
        usage=Usage(**(run.usage or {})),
        providers=list(run.providers or []),
        prompt_versions=dict(run.prompt_versions or {}),
        error=run.error,
    )


async def _get_run(session: SessionDep, principal: Principal, run_id: str) -> Run:
    run = await session.get(Run, run_id)
    if run is None or run.org_id != principal.org_id:  # tenant isolation: 404, never 403, to avoid ID probing
        raise HTTPException(status.HTTP_404_NOT_FOUND, "run not found")
    return run


@router.post("", response_model=RunDetail, status_code=status.HTTP_201_CREATED)
async def create_run(
    body: RunCreate, principal: PrincipalDep, session: SessionDep, container: ContainerDep
) -> RunDetail:
    principal.require(Permission.RUN_CREATE)
    run = await container.runs.create(session, principal, body)
    return _detail(run)


@router.get("", response_model=list[RunSummary])
async def list_runs(
    principal: PrincipalDep,
    session: SessionDep,
    project: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    before: datetime | None = None,
) -> list[RunSummary]:
    principal.require(Permission.RUN_READ)
    stmt = select(Run).where(Run.org_id == principal.org_id)
    if project:
        stmt = stmt.where(Run.project == project)
    if before:
        stmt = stmt.where(Run.created_at < before)
    rows = (await session.scalars(stmt.order_by(Run.created_at.desc()).limit(limit))).all()
    return [_summary(r) for r in rows]


@router.get("/{run_id}", response_model=RunDetail)
async def get_run(run_id: str, principal: PrincipalDep, session: SessionDep) -> RunDetail:
    principal.require(Permission.RUN_READ)
    return _detail(await _get_run(session, principal, run_id))


@router.get("/{run_id}/events", response_class=StreamingResponse)
async def stream_events(
    run_id: str,
    principal: PrincipalDep,
    session: SessionDep,
    container: ContainerDep,
    last_event_id: Annotated[str | None, Header()] = None,
    after: Annotated[int | None, Query(ge=0)] = None,
) -> StreamingResponse:
    """Server-Sent Events. Resume with the `Last-Event-ID` header (or `?after=<seq>`)."""
    principal.require(Permission.RUN_READ)
    await _get_run(session, principal, run_id)
    start = after if after is not None else int(last_event_id) if last_event_id and last_event_id.isdigit() else 0

    async def gen() -> AsyncIterator[str]:
        yield "retry: 3000\n\n"
        async for ev in container.runs.stream(run_id, start):
            if ev.type == "heartbeat":
                yield ": ping\n\n"
                continue
            yield f"id: {ev.seq}\nevent: {ev.type}\ndata: {json.dumps(ev.model_dump(mode='json'))}\n\n"

    return StreamingResponse(
        gen(), media_type="text/event-stream", headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"}
    )


@router.post("/{run_id}/cancel", response_model=RunSummary)
async def cancel_run(run_id: str, principal: PrincipalDep, session: SessionDep, container: ContainerDep) -> RunSummary:
    principal.require(Permission.RUN_CANCEL)
    run = await _get_run(session, principal, run_id)
    if run.status not in (RunStatus.QUEUED.value, RunStatus.RUNNING.value):
        raise HTTPException(status.HTTP_409_CONFLICT, f"run is {run.status}")
    await container.runs.cancel(run_id)
    await audit(session, principal, "run.cancel", run_id)
    await session.commit()
    await session.refresh(run)
    return _summary(run)


@router.post("/{run_id}/decision", response_model=DecisionResponse)
async def decide(
    run_id: str, body: DecisionRequest, principal: PrincipalDep, session: SessionDep, container: ContainerDep
) -> DecisionResponse:
    principal.require(Permission.DECISION_WRITE)
    run = await _get_run(session, principal, run_id)
    if run.status != RunStatus.SUCCEEDED.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "only succeeded runs can be decided")
    result = RunResult.model_validate(run.result or {})
    committed, child_id = False, None
    detail = f"Decision {body.status}."

    if body.status == "accepted":
        if run.simulated:
            detail = "Accepted. Not committed to memory because the run used simulated output."
        elif result.directive:
            await container.memory.commit(
                session,
                run.org_id,
                run.project,
                f"Decision ({run.mode}) for '{run.mission[:160]}': {result.directive.decision} Rationale: {result.directive.rationale}",
                run.id,
            )
            committed, detail = True, "Accepted and committed to project memory."
    elif body.status == "challenged":
        issues = (result.verdict.unresolved_issues if result.verdict else []) or (
            [result.critiques[-1].most_dangerous_assumption] if result.critiques else []
        )
        refinement = (body.note or "Stress-test the decision under adversarial and safety constraints") + (
            f". Resolve: {'; '.join(issues)[:600]}" if issues else ""
        )
        run.decision_status = DecisionStatus.CHALLENGED.value
        await session.commit()
        child = await container.runs.create(
            session,
            principal,
            RunCreate(
                mission=run.mission,
                mode=MissionMode(run.mode),
                refinement=refinement[:1000],
                parent_run_id=run.id,
                project=run.project,
            ),
        )
        child_id, detail = child.id, "Challenge opened a refinement run."

    run.decision_status = DecisionStatus(body.status).value
    await audit(
        session,
        principal,
        f"decision.{body.status}",
        run.id,
        {"note": body.note, "memory_committed": committed, "child": child_id, "confidence": run.confidence},
    )
    await session.commit()
    return DecisionResponse(
        run_id=run.id,
        status=DecisionStatus(run.decision_status),
        memory_committed=committed,
        challenge_run_id=child_id,
        detail=detail,
    )


@router.get("/{run_id}/export.md", response_class=PlainTextResponse)
async def export_markdown(run_id: str, principal: PrincipalDep, session: SessionDep) -> PlainTextResponse:
    principal.require(Permission.RUN_READ)
    run = await _get_run(session, principal, run_id)
    return PlainTextResponse(
        directive_markdown(run),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="nexus-directive-{run.id[:8]}.md"'},
    )
