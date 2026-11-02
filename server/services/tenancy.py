"""Just-in-time provisioning of organisations, users, and memberships from verified identity.

Idempotent under concurrency: parallel first requests from a new identity race to insert the same
rows; the loser hits a unique-constraint violation, rolls back, and re-reads what the winner wrote.
"""

from __future__ import annotations

from dataclasses import replace

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.security import Principal
from server.db.models import Membership, Organization, User


async def _provision(session: AsyncSession, principal: Principal) -> str:
    if await session.get(Organization, principal.org_id) is None:
        session.add(Organization(id=principal.org_id, name=principal.org_id))
        await session.flush()
    user = await session.scalar(select(User).where(User.subject == principal.subject))
    if user is None:
        user = User(subject=principal.subject, email=principal.email)
        session.add(user)
        await session.flush()
    roles = sorted(r.value for r in principal.roles)
    membership = await session.get(Membership, (user.id, principal.org_id))
    if membership is None:
        session.add(Membership(user_id=user.id, org_id=principal.org_id, roles=roles))
    elif membership.roles != roles:
        membership.roles = roles  # the IdP is the source of truth for roles
    await session.commit()
    return user.id


async def ensure_principal(session: AsyncSession, principal: Principal, attempts: int = 3) -> Principal:
    for attempt in range(attempts):
        try:
            return replace(principal, user_id=await _provision(session, principal))
        except IntegrityError:
            await session.rollback()
            if attempt == attempts - 1:
                raise
    raise AssertionError("unreachable")
