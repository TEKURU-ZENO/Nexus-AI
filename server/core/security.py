"""Authentication (dev / HS256 JWT / OIDC JWKS) and role-based access control."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from functools import lru_cache

import jwt
from fastapi import HTTPException, status

from server.core.config import AuthMode, Settings


class Role(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    AUDITOR = "auditor"


class Permission(StrEnum):
    RUN_CREATE = "run:create"
    RUN_READ = "run:read"
    RUN_CANCEL = "run:cancel"
    DECISION_WRITE = "decision:write"
    MEMORY_READ = "memory:read"
    MEMORY_DELETE = "memory:delete"
    AUDIT_READ = "audit:read"
    ORG_ADMIN = "org:admin"


_READ = {Permission.RUN_READ, Permission.MEMORY_READ}
_EDIT = _READ | {Permission.RUN_CREATE, Permission.RUN_CANCEL, Permission.DECISION_WRITE}
ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.VIEWER: _READ,
    Role.AUDITOR: _READ | {Permission.AUDIT_READ},
    Role.EDITOR: _EDIT,
    Role.ADMIN: _EDIT | {Permission.MEMORY_DELETE, Permission.AUDIT_READ},
    Role.OWNER: set(Permission),
}


@dataclass(frozen=True)
class Principal:
    subject: str
    org_id: str
    roles: frozenset[Role]
    email: str | None = None
    user_id: str = field(default="", compare=False)

    @property
    def permissions(self) -> set[Permission]:
        perms: set[Permission] = set()
        for role in self.roles:
            perms |= ROLE_PERMISSIONS.get(role, set())
        return perms

    def require(self, permission: Permission) -> None:
        if permission not in self.permissions:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"missing permission: {permission.value}")


DEV_PRINCIPAL = Principal(subject="dev|local", org_id="local", roles=frozenset({Role.OWNER}), email="dev@localhost")


def _parse_roles(raw: object) -> frozenset[Role]:
    values = raw if isinstance(raw, list) else str(raw or "").replace(",", " ").split()
    roles = {Role(v) for v in values if v in Role._value2member_map_}
    return frozenset(roles or {Role.VIEWER})


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


def authenticate(authorization: str | None, settings: Settings) -> Principal:
    if settings.auth_mode is AuthMode.DEV:
        return DEV_PRINCIPAL
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "missing bearer token", headers={"WWW-Authenticate": "Bearer"}
        )
    token = authorization.split(" ", 1)[1].strip()
    options = {"require": ["exp", "sub"]}
    try:
        if settings.auth_mode is AuthMode.JWT:
            assert settings.auth_jwt_secret
            claims = jwt.decode(
                token,
                settings.auth_jwt_secret.get_secret_value(),
                algorithms=["HS256"],
                audience=settings.auth_audience,
                issuer=settings.auth_issuer,
                options=options,  # type: ignore[arg-type]
            )
        else:
            assert settings.auth_jwks_url
            key = _jwks_client(settings.auth_jwks_url).get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256", "ES256"],
                audience=settings.auth_audience,
                issuer=settings.auth_issuer,
                options=options,  # type: ignore[arg-type]
            )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, f"invalid token: {type(exc).__name__}", headers={"WWW-Authenticate": "Bearer"}
        ) from exc

    org = claims.get(settings.auth_org_claim)
    if not org:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"token has no '{settings.auth_org_claim}' claim")
    return Principal(
        subject=str(claims["sub"]),
        org_id=str(org),
        roles=_parse_roles(claims.get(settings.auth_roles_claim)),
        email=claims.get("email"),
    )


def issue_dev_token(settings: Settings, *, subject: str, org: str, roles: list[str], ttl_s: int = 3600) -> str:
    """Mint an HS256 token (AUTH_MODE=jwt) for local testing and service accounts."""
    import time

    if not settings.auth_jwt_secret:
        raise RuntimeError("AUTH_JWT_SECRET not set")
    now = int(time.time())
    claims: dict[str, object] = {
        "sub": subject,
        settings.auth_org_claim: org,
        settings.auth_roles_claim: roles,
        "iat": now,
        "exp": now + ttl_s,
    }
    if settings.auth_issuer:
        claims["iss"] = settings.auth_issuer
    if settings.auth_audience:
        claims["aud"] = settings.auth_audience
    return jwt.encode(claims, settings.auth_jwt_secret.get_secret_value(), algorithm="HS256")
