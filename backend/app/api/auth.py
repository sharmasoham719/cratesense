"""
GET /auth/session and the get_current_user/require_auth dependencies, per
knowledge-base/AUTH_AND_SECURITY.md §1/§2. With DEV_OVERRIDE=true, every
route reflects a static dev identity with no token verification. With
DEV_OVERRIDE=false, the frontend forwards the Google-issued id_token
(from NextAuth) as a Bearer token, and this module verifies it directly
against Google's public keys -- independent of the frontend's own claim
of being authenticated, per the "backend must never trust the frontend"
requirement.
"""

from dataclasses import dataclass

from fastapi import APIRouter, Depends, Header, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

_google_request = google_requests.Request()


class SessionResponse(BaseModel):
    authenticated: bool
    user_name: str | None = None
    user_email: str | None = None
    dev_override: bool


@dataclass
class CurrentUser:
    name: str | None
    email: str | None


def _verify_google_token(token: str) -> CurrentUser:
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured on the backend.")
    try:
        claims = google_id_token.verify_oauth2_token(token, _google_request, settings.google_client_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google session token: {exc}") from exc
    return CurrentUser(name=claims.get("name"), email=claims.get("email"))


def get_current_user(
    authorization: str | None = Header(default=None),
    token: str | None = None,
) -> CurrentUser:
    """FastAPI dependency for protected routes (/rows, /jobs, /evaluation
    per knowledge-base/AUTH_AND_SECURITY.md §3). DEV_OVERRIDE bypasses
    entirely with a static dev identity; otherwise the Bearer token is
    verified against Google directly. Also accepts the token as a
    `?token=` query param -- EventSource (used by /jobs/{id}/stream)
    cannot set custom headers in all environments, so query-param-as-token
    is the pragmatic SSE-auth pattern the spec calls for."""
    if settings.dev_override:
        return CurrentUser(name="Dev User", email="dev@local")

    bearer_token = authorization.removeprefix("Bearer ").strip() if authorization and authorization.startswith("Bearer ") else None
    effective_token = bearer_token or token
    if not effective_token:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return _verify_google_token(effective_token)


def require_auth(user: CurrentUser = Depends(get_current_user)) -> None:  # noqa: ARG001
    """Router-level dependency (Depends(require_auth)) used by /rows,
    /jobs, /evaluation, /review-queue, /jobs/{id}/stream -- delegates to
    get_current_user so every protected route gets real verification."""
    return None


@router.get("/session", response_model=SessionResponse)
def get_session(authorization: str | None = Header(default=None)) -> SessionResponse:
    if settings.dev_override:
        return SessionResponse(
            authenticated=True,
            user_name="Dev User",
            user_email="dev@local",
            dev_override=True,
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    token = authorization.removeprefix("Bearer ").strip()
    user = _verify_google_token(token)
    return SessionResponse(authenticated=True, user_name=user.name, user_email=user.email, dev_override=False)
