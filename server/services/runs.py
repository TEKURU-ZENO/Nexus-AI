"""Run lifecycle: create → execute (LangGraph) → persist events → stream → decide.

Every event is appended to `run_events` with a monotonically increasing `seq`, so streams can be
resumed with `Last-Event-ID`, replayed later, and audited. Live subscribers receive events through
in-process queues. Executions are cancelled when every subscriber has gone for
RUN_ORPHAN_TIMEOUT_S (so abandoned tabs stop spending tokens).

Scaling note: execution runs in-process via asyncio tasks. For horizontal scale, move `execute` to a
worker queue (Arq/Celery/Temporal) and swap `EventBus` for Redis pub/sub; the API is unchanged.
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.config import Settings
from server.core.ratelimit import RateLimiter
from server.core.security import Principal
from server.core.telemetry import ACTIVE_RUNS, RUN_COST, RUN_DURATION, RUNS
from server.db.models import Organization, Run, RunEventRow
from server.db.session import Database
from server.engine.graph import MISSION_GRAPH, EngineDeps, MissionState
from server.engine.safety import normalize
from server.llm.gateway import Budget, BudgetExceeded, LLMGateway
from server.memory.store import MemoryStore
from server.prompts import all_prompt_versions
from server.schemas.api import RunCreate, RunEvent, RunResult, RunStatus
from server.services.audit import audit
from server.tools.search import SearchTool

log = structlog.get_logger(__name__)

TERMINAL = {RunStatus.SUCCEEDED.value, RunStatus.FAILED.value, RunStatus.CANCELLED.value}


class EventBus:
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue[RunEvent | None]]] = defaultdict(set)

    def subscribe(self, run_id: str) -> asyncio.Queue[RunEvent | None]:
        q: asyncio.Queue[RunEvent | None] = asyncio.Queue()
        self._subs[run_id].add(q)
        return q

    def unsubscribe(self, run_id: str, q: asyncio.Queue[RunEvent | None]) -> int:
        self._subs[run_id].discard(q)
        remaining = len(self._subs[run_id])
        if not remaining:
            self._subs.pop(run_id, None)
        return remaining

    def count(self, run_id: str) -> int:
        return len(self._subs.get(run_id, ()))

    def publish(self, run_id: str, event: RunEvent | None) -> None:
        for q in list(self._subs.get(run_id, ())):
            q.put_nowait(event)


class RunService:
    def __init__(
        self,
        *,
        settings: Settings,
        db: Database,
        gateway: LLMGateway,
        memory: MemoryStore,
        search: SearchTool,
    ) -> None:
        self.settings = settings
        self.db = db
        self.gateway = gateway
        self.memory = memory
        self.search = search
        self.bus = EventBus()
        self.limiter = RateLimiter(settings.runs_per_minute)
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._seq: dict[str, int] = {}
        self._orphan_timers: dict[str, asyncio.TimerHandle] = {}

    # ------------------------------------------------------------------ create

    async def spend_today(self, session: AsyncSession, org_id: str) -> float:
        midnight = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        total = await session.scalar(
            select(func.coalesce(func.sum(Run.cost_usd), 0.0)).where(Run.org_id == org_id, Run.created_at >= midnight)
        )
        return float(total or 0.0)

    async def create(self, session: AsyncSession, principal: Principal, body: RunCreate) -> Run:
        self.limiter.hit(f"{principal.org_id}:{principal.subject}")
        org = await session.get(Organization, principal.org_id)
        cap = org.daily_spend_usd if org and org.daily_spend_usd is not None else self.settings.org_daily_spend_usd
        if await self.spend_today(session, principal.org_id) >= cap:
            raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, f"organisation daily spend cap (${cap:.2f}) reached")
        if body.parent_run_id:
            parent = await session.get(Run, body.parent_run_id)
            if not parent or parent.org_id != principal.org_id:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "parent run not found")

        run = Run(
            org_id=principal.org_id,
            user_id=principal.user_id or None,
            project=body.project,
            mission=normalize(body.mission, self.settings.mission_max_chars),
            mode=body.mode.value,
            refinement=normalize(body.refinement, 1000) if body.refinement else None,
            parent_run_id=body.parent_run_id,
            status=RunStatus.QUEUED.value,
            prompt_versions=all_prompt_versions(),
        )
        session.add(run)
        await session.flush()
        await audit(
            session,
            principal,
            "run.create",
            run.id,
            {"mode": run.mode, "project": run.project, "parent": run.parent_run_id},
        )
        await session.commit()
        if self.settings.run_execution == "background":
            self.start(run.id)
        return run

    def start(self, run_id: str) -> None:
        if run_id not in self._tasks:
            task = asyncio.create_task(self.execute(run_id), name=f"run-{run_id}")
            self._tasks[run_id] = task
            task.add_done_callback(lambda _t: self._tasks.pop(run_id, None))

    # ------------------------------------------------------------------ events

    async def _append(
        self, run_id: str, type_: str, agent: str | None, message: str, data: dict[str, Any] | None = None
    ) -> RunEvent:
        seq = self._seq.get(run_id, 0) + 1
        self._seq[run_id] = seq
        event = RunEvent(seq=seq, type=type_, agent=agent, message=message[:4000], data=data, at=datetime.now(UTC))
        async with self.db.sessionmaker() as s:
            s.add(
                RunEventRow(
                    run_id=run_id, seq=seq, type=type_, agent=agent, message=event.message, data=data, at=event.at
                )
            )
            await s.commit()
        self.bus.publish(run_id, event)
        return event

    # ------------------------------------------------------------------ execute

    async def execute(self, run_id: str) -> None:
        started = time.perf_counter()
        ACTIVE_RUNS.inc()
        async with self.db.sessionmaker() as s:
            run = await s.get(Run, run_id)
            if run is None:
                ACTIVE_RUNS.dec()
                return
            self._seq[run_id] = int(
                await s.scalar(select(func.coalesce(func.max(RunEventRow.seq), 0)).where(RunEventRow.run_id == run_id))
                or 0
            )
            run.status, run.started_at = RunStatus.RUNNING.value, datetime.now(UTC)
            memories = await self.memory.recall(s, run.org_id, run.project, run.mission)
            await s.commit()
            mission, mode, refinement = run.mission, run.mode, run.refinement

        budget = Budget(self.settings.run_token_budget)
        deps = EngineDeps(
            gateway=self.gateway, budget=budget, search=self.search, max_rounds=self.settings.debate_max_rounds
        )
        final: dict[str, Any] = {}
        terminal = RunStatus.SUCCEEDED
        error: str | None = None
        try:
            await self._append(
                run_id,
                "run_start",
                "orchestrator",
                f"{mode} mission accepted.",
                {"live_providers": self.gateway.live_provider_names, "simulator_only": self.gateway.simulator_only},
            )
            if memories:
                await self._append(
                    run_id,
                    "memory_recall",
                    "memory",
                    f"Recalled {len(memories)} accepted decision(s).",
                    {"memory": memories},
                )
            state: MissionState = {"mission": mission, "mode": mode, "refinement": refinement, "memory": memories}
            stream: AsyncIterator[Any] = MISSION_GRAPH.astream(
                state, config={"configurable": {"deps": deps}, "recursion_limit": 40}, stream_mode=["custom", "values"]
            )
            async with asyncio.timeout(self.settings.run_timeout_s):
                async for mode_, chunk in stream:
                    if mode_ == "custom":
                        await self._append(
                            run_id, chunk["type"], chunk.get("agent"), chunk.get("message", ""), chunk.get("data")
                        )
                    else:
                        final = chunk
            if final.get("blocked"):
                terminal, error = RunStatus.FAILED, "mission blocked by safety policy"
        except asyncio.CancelledError:
            terminal, error = RunStatus.CANCELLED, "cancelled"
        except BudgetExceeded as exc:
            terminal, error = RunStatus.FAILED, str(exc)
        except TimeoutError:
            terminal, error = RunStatus.FAILED, f"run exceeded {self.settings.run_timeout_s:.0f}s time limit"
        except Exception as exc:
            log.exception("run.failed", run_id=run_id)
            terminal, error = RunStatus.FAILED, f"internal error ({type(exc).__name__})"
        finally:
            ACTIVE_RUNS.dec()

        result = RunResult(
            plan=final.get("plan"),
            reports=final.get("reports", {}),
            critiques=final.get("critiques", []),
            rebuttals=final.get("rebuttals", []),
            verdict=final.get("verdict"),
            directive=final.get("directive"),
            confidence=final.get("confidence"),
            memory_used=memories,
            safety_flags=final.get("safety_flags", []),
        )
        simulated = bool(final.get("simulated")) or self.gateway.simulator_only
        usage = {
            "input_tokens": budget.input_tokens,
            "output_tokens": budget.output_tokens,
            "cost_usd": round(budget.cost_usd, 6),
            "llm_calls": budget.calls,
        }
        async with self.db.sessionmaker() as s:
            await s.execute(
                update(Run)
                .where(Run.id == run_id)
                .values(
                    status=terminal.value,
                    result=result.model_dump(mode="json"),
                    confidence=result.confidence.score if result.confidence else None,
                    simulated=simulated,
                    usage=usage,
                    cost_usd=budget.cost_usd,
                    providers=sorted(set(final.get("providers", []))),
                    error=error,
                    finished_at=datetime.now(UTC),
                )
            )
            await s.commit()
        RUNS.labels(terminal.value, str(simulated).lower()).inc()
        RUN_DURATION.observe(time.perf_counter() - started)
        RUN_COST.inc(budget.cost_usd)
        await asyncio.shield(
            self._append(
                run_id,
                "run_complete",
                "orchestrator",
                "Synthesis complete." if terminal is RunStatus.SUCCEEDED else f"Run {terminal.value}: {error}",
                {
                    "status": terminal.value,
                    "confidence": result.confidence.score if result.confidence else None,
                    "simulated": simulated,
                    "usage": usage,
                },
            )
        )
        self.bus.publish(run_id, None)
        self._seq.pop(run_id, None)

    # ------------------------------------------------------------------ stream

    async def _claim(self, run_id: str) -> bool:
        """Atomically move a queued run to running; True only for the single winner."""
        async with self.db.sessionmaker() as s:
            result = await s.execute(
                update(Run)
                .where(Run.id == run_id, Run.status == RunStatus.QUEUED.value)
                .values(status=RunStatus.RUNNING.value, started_at=datetime.now(UTC))
            )
            await s.commit()
            return bool(getattr(result, "rowcount", 0))

    async def stream(self, run_id: str, after_seq: int) -> AsyncIterator[RunEvent]:
        q = self.bus.subscribe(run_id)
        if self.settings.run_execution == "on_stream" and run_id not in self._tasks and await self._claim(run_id):
            self.start(run_id)
        self._cancel_orphan_timer(run_id)
        last = after_seq
        try:
            async with self.db.sessionmaker() as s:
                rows = (
                    await s.scalars(
                        select(RunEventRow)
                        .where(RunEventRow.run_id == run_id, RunEventRow.seq > after_seq)
                        .order_by(RunEventRow.seq)
                    )
                ).all()
                run = await s.get(Run, run_id)
            for row in rows:
                last = row.seq
                yield RunEvent(
                    seq=row.seq, type=row.type, agent=row.agent, message=row.message, data=row.data, at=row.at
                )
            if run is None or (run.status in TERMINAL and run_id not in self._tasks):
                return
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15)
                except TimeoutError:
                    yield RunEvent(seq=-1, type="heartbeat", message="", at=datetime.now(UTC))
                    continue
                if event is None:
                    return
                if event.seq <= last:
                    continue
                last = event.seq
                yield event
                if event.type == "run_complete":
                    return
        finally:
            if self.bus.unsubscribe(run_id, q) == 0 and run_id in self._tasks:
                self._schedule_orphan_cancel(run_id)

    def _schedule_orphan_cancel(self, run_id: str) -> None:
        timeout = self.settings.run_orphan_timeout_s
        if timeout <= 0:
            return
        loop = asyncio.get_running_loop()

        def _fire() -> None:
            self._orphan_timers.pop(run_id, None)
            if self.bus.count(run_id) == 0 and (task := self._tasks.get(run_id)):
                log.info("run.orphan_cancel", run_id=run_id)
                task.cancel()

        self._orphan_timers[run_id] = loop.call_later(timeout, _fire)

    def _cancel_orphan_timer(self, run_id: str) -> None:
        if timer := self._orphan_timers.pop(run_id, None):
            timer.cancel()

    # ------------------------------------------------------------------ control

    async def cancel(self, run_id: str) -> bool:
        task = self._tasks.get(run_id)
        if task and not task.done():
            task.cancel()
            return True
        # Not executing here: a queued run that nobody has claimed can be cancelled directly.
        async with self.db.sessionmaker() as s:
            result = await s.execute(
                update(Run)
                .where(Run.id == run_id, Run.status == RunStatus.QUEUED.value)
                .values(status=RunStatus.CANCELLED.value, error="cancelled", finished_at=datetime.now(UTC))
            )
            await s.commit()
            return bool(getattr(result, "rowcount", 0))

    async def sweep_stale(self) -> int:
        """Fail runs abandoned by a crashed or recycled worker.

        Time-based (not "everything at boot") so that it is safe with many instances: a run older than the
        hard timeout plus grace cannot still be executing anywhere.
        """
        cutoff = datetime.now(UTC) - timedelta(seconds=self.settings.run_timeout_s + 120)
        async with self.db.sessionmaker() as s:
            result = await s.execute(
                update(Run)
                .where(Run.status.in_([RunStatus.QUEUED.value, RunStatus.RUNNING.value]), Run.created_at < cutoff)
                .values(
                    status=RunStatus.FAILED.value, error="abandoned (worker stopped)", finished_at=datetime.now(UTC)
                )
            )
            await s.commit()
            return int(getattr(result, "rowcount", 0) or 0)

    async def sweeper(self, interval_s: float = 60.0) -> None:
        while True:  # startup already swept once, so wait first
            await asyncio.sleep(interval_s)
            try:
                if swept := await self.sweep_stale():
                    log.warning("run.swept_stale", count=swept)
            except Exception:  # the sweeper must never die
                log.exception("run.sweeper_failed")

    async def shutdown(self) -> None:
        for task in list(self._tasks.values()):
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks.values(), return_exceptions=True)
