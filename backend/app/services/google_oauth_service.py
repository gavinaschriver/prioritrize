"""OAuth 2.0 + PKCE against Google, and encryption of the resulting tokens.

The identity problem this solves: Google's callback is a top-level browser
navigation carrying no Authorization header, and the frontend (Vercel) and API
(Fly) are on different origins so there is no usable cookie either. The
Supabase user id therefore travels inside the `state` value, backed by a
server-side row that is deleted on consumption — single-use, so replay
protection comes for free.
"""

import asyncpg
import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from uuid import UUID

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app.config import settings

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"
USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"

# Secondary calendars only: this scope can create calendars and fully manage
# events on the ones it created, and cannot see or touch the user's primary or
# work calendars at all. It also covers calendarList.update, which we need to
# make the new calendar visible.
SCOPE = "https://www.googleapis.com/auth/calendar.app.created"

HTTP_TIMEOUT = 15.0


def to_uuid(val) -> UUID:
    return UUID(val) if isinstance(val, str) else val


# --- token encryption -------------------------------------------------------

def _fernet() -> Fernet:
    if not settings.token_encryption_key:
        raise HTTPException(status_code=503, detail="TOKEN_ENCRYPTION_KEY is not configured")
    try:
        return Fernet(settings.token_encryption_key.encode())
    except Exception:
        raise HTTPException(status_code=503, detail="TOKEN_ENCRYPTION_KEY is not a valid Fernet key")


def encrypt(plaintext: str | None) -> str | None:
    if plaintext is None:
        return None
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str | None) -> str | None:
    if ciphertext is None:
        return None
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        # Almost always a rotated or lost TOKEN_ENCRYPTION_KEY.
        return None


def require_configured() -> None:
    if not settings.google_configured:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar integration is not configured on this server",
        )


# --- authorization ----------------------------------------------------------

def _pkce_pair() -> tuple[str, str]:
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode()
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
        .rstrip(b"=")
        .decode()
    )
    return verifier, challenge


async def start_authorization(
    conn: asyncpg.Connection,
    user_id: str,
    tz_str: str,
    redirect_path: str,
) -> str:
    """Create a single-use state row and return the Google consent URL."""
    require_configured()
    state = secrets.token_urlsafe(32)
    verifier, challenge = _pkce_pair()

    await conn.execute(
        """
        INSERT INTO google_oauth_state (state, user_id, code_verifier, redirect_path, timezone)
        VALUES ($1, $2, $3, $4, $5)
        """,
        state, to_uuid(user_id), verifier, redirect_path or "/settings", tz_str or "UTC",
    )
    # Opportunistic cleanup; these rows live 10 minutes and are tiny.
    await conn.execute("DELETE FROM google_oauth_state WHERE expires_at < now()")

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": SCOPE,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        # Both are required on EVERY authorization, not just the first. Without
        # prompt=consent a re-authorization returns no refresh_token at all and
        # reconnecting silently produces an unusable connection.
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    }
    return f"{AUTH_ENDPOINT}?{urlencode(params)}"


async def consume_state(conn: asyncpg.Connection, state: str) -> asyncpg.Record | None:
    """Atomically claim the state row. One statement, so no transaction needed."""
    return await conn.fetchrow(
        """
        DELETE FROM google_oauth_state
        WHERE state = $1 AND expires_at > now()
        RETURNING user_id, code_verifier, redirect_path, timezone
        """,
        state,
    )


# --- token exchange ---------------------------------------------------------

async def exchange_code(code: str, code_verifier: str) -> dict:
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.post(
            TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                # Must byte-match the value used in the authorization request.
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Google token exchange failed: {resp.text}")
    return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    """Raises GoogleAuthError on invalid_grant, which is terminal."""
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.post(
            TOKEN_ENDPOINT,
            data={
                "refresh_token": refresh_token,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "grant_type": "refresh_token",
            },
        )
    if resp.status_code != 200:
        body = resp.text
        if "invalid_grant" in body:
            # Revoked, expired, or the 7-day "Testing" publishing-status trap.
            # Terminal: retrying cannot help.
            raise GoogleAuthError(f"invalid_grant: {body}")
        raise GoogleAuthError(f"token refresh failed ({resp.status_code}): {body}")
    return resp.json()


async def fetch_account_email(access_token: str) -> str | None:
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.get(
            USERINFO_ENDPOINT, headers={"Authorization": f"Bearer {access_token}"}
        )
    if resp.status_code != 200:
        return None
    return resp.json().get("email")


async def revoke(token: str) -> None:
    """Best effort — a token Google has already dropped 400s, which is fine."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            await client.post(REVOKE_ENDPOINT, data={"token": token})
    except httpx.HTTPError:
        pass


class GoogleAuthError(Exception):
    """Token refresh failed. `terminal` means re-authorization is required."""

    @property
    def terminal(self) -> bool:
        return "invalid_grant" in str(self)


# --- persistence ------------------------------------------------------------

async def upsert_connection(
    conn: asyncpg.Connection,
    user_id: str,
    token_payload: dict,
    tz_str: str,
    email: str | None,
) -> asyncpg.Record:
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=int(token_payload.get("expires_in", 3600))
    )
    refresh_token = token_payload.get("refresh_token")

    return await conn.fetchrow(
        """
        INSERT INTO google_calendar_connection (
            user_id, google_account_email, refresh_token, access_token,
            access_token_expires_at, scope, timezone, status, last_error, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'connected', NULL, now())
        ON CONFLICT (user_id) DO UPDATE SET
            google_account_email    = EXCLUDED.google_account_email,
            -- Google only returns a refresh token when it feels like it; never
            -- overwrite a good one with NULL.
            refresh_token           = COALESCE(EXCLUDED.refresh_token,
                                               google_calendar_connection.refresh_token),
            access_token            = EXCLUDED.access_token,
            access_token_expires_at = EXCLUDED.access_token_expires_at,
            scope                   = EXCLUDED.scope,
            timezone                = EXCLUDED.timezone,
            status                  = 'connected',
            last_error              = NULL,
            updated_at              = now()
        RETURNING *
        """,
        to_uuid(user_id),
        email,
        encrypt(refresh_token),
        encrypt(token_payload.get("access_token")),
        expires_at,
        token_payload.get("scope"),
        tz_str or "UTC",
    )


async def get_connection(conn: asyncpg.Connection, user_id: str) -> asyncpg.Record | None:
    return await conn.fetchrow(
        "SELECT * FROM google_calendar_connection WHERE user_id = $1", to_uuid(user_id)
    )


async def set_status(
    conn: asyncpg.Connection, user_id: str, status: str, error: str | None = None
) -> None:
    await conn.execute(
        """
        UPDATE google_calendar_connection
        SET status = $2, last_error = $3, updated_at = now()
        WHERE user_id = $1
        """,
        to_uuid(user_id), status, (error or "")[:2000] or None,
    )


async def delete_connection(conn: asyncpg.Connection, user_id: str) -> None:
    uid = to_uuid(user_id)
    await conn.execute("DELETE FROM google_calendar_event WHERE user_id = $1", uid)
    await conn.execute("DELETE FROM google_calendar_connection WHERE user_id = $1", uid)
