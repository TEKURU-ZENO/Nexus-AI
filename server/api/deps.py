from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.config import Settings
from server.core.security import Principal, authenticate
from server.db.session import Database
from server.llm.gateway import LLMGateway
from server.memory.store import MemoryStore
from server.services.runs import RunService
from server.services.tenancy import ensure_principal


@dataclass
class Container:
    settings: Settings
    db: Database
    gateway: LLMGateway
    memory: MemoryStore
    runs: RunService


def get_container(request: Request) -> Container:
    return request.app.state.container  # type: ignore[no-any-return]


async def get_session(container: Annotated[Container, Depends(get_container)]) -> AsyncIterator[AsyncSession]:
    async with container.db.sessionmaker() as session:
        yield session


async def get_principal(
    container: Annotated[Container, Depends(get_container)],
    session: Annotated[AsyncSession, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> Principal:
    principal = authenticate(authorization, container.settings)
    return await ensure_principal(session, principal)


ContainerDep = Annotated[Container, Depends(get_container)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
PrincipalDep = Annotated[Principal, Depends(get_principal)]
