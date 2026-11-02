"""Just-in-time provisioning of organisations, users, and memberships from verified identity."""

from __future__ import annotations

from dataclasses import replace

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.core.security import Principal
from server.db.models import Membership, Organization, User


async def ensure_principal(session: AsyncSession, principal: Principal) -> Principal:
    org = await session.get(Organization, principal.org_id)
    if org is None:
        session.add(Organization(id=principal.org_id, name=principal.org_id))
    user = await session.scalar(select(User).where(User.subject == principal.subject))
    if user is None:
        user = User(subject=principal.subject, email=principal.email)
        session.add(user)
        await session.flush()
    membership = await session.get(Membership, (user.id, principal.org_id))
    roles = sorted(r.value for r in principal.roles)
    if membership is None:
        session.add(Membership(user_id=user.id, org_id=principal.org_id, roles=roles))
    elif membership.roles != roles:
        membership.roles = roles  # IdP is the source of truth for roles
    await session.commit()
    return replace(principal, user_id=user.id)
