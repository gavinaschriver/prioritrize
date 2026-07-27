"""Minimal async Google Calendar client.

Raw httpx rather than google-api-python-client: the official client is
synchronous, so every call would block the event loop inside a BackgroundTasks
coroutine on a single-worker uvicorn; it pulls google-auth, httplib2 and
protobuf onto a 256MB VM; and it fetches a discovery document at startup. We
need six endpoints, and this also matches a codebase that writes raw SQL rather
than using an ORM.

Calls are issued sequentially on purpose. At this scale concurrency buys
nothing and only risks clustering into a rate limit.
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone

import asyncpg
import httpx

from app.services import google_oauth_service as oauth
from app.services.google_oauth_service import GoogleAuthError

CALENDAR_API = "https://www.googleapis.com/calendar/v3"
HTTP_TIMEOUT = 15.0
MAX_ATTEMPTS = 4
RETRY_STATUSES = {429, 500, 502, 503, 504}


class GoogleCalendarError(Exception):
    """Non-terminal failure. The nightly reconcile will retry."""


class GooglePermissionError(Exception):
    """Terminal configuration problem — scopes are wrong. Retrying won't help."""


class GoogleEventGoneError(Exception):
    """404/410 — the event no longer exists in Google."""


class GoogleCalendarClient:
    """Wraps one user's connection. Refreshes tokens and counts API calls.

    The call count is what proves the reconcile is idempotent: a second run
    over unchanged data must issue zero calls.
    """

    def __init__(self, conn: asyncpg.Connection, connection_row: asyncpg.Record):
        self._conn = conn
        self._row = dict(connection_row)
        self.api_calls = 0

    @property
    def calendar_id(self) -> str | None:
        return self._row.get("calendar_id")

    # --- auth ---------------------------------------------------------------

    async def _access_token(self) -> str:
        """Refresh proactively — a token expiring mid-reconcile costs a retry."""
        expires_at = self._row.get("access_token_expires_at")
        token = oauth.decrypt(self._row.get("access_token"))

        if token and expires_at and expires_at > datetime.now(timezone.utc) + timedelta(seconds=60):
            return token

        refresh_token = oauth.decrypt(self._row.get("refresh_token"))
        if not refresh_token:
            raise GoogleAuthError("invalid_grant: no refresh token stored")

        payload = await oauth.refresh_access_token(refresh_token)
        new_access = payload["access_token"]
        new_expiry = datetime.now(timezone.utc) + timedelta(
            seconds=int(payload.get("expires_in", 3600))
        )
        # Google may rotate the refresh token; persist it when it does.
        rotated = payload.get("refresh_token")

        await self._conn.execute(
            """
            UPDATE google_calendar_connection
            SET access_token = $2,
                access_token_expires_at = $3,
                refresh_token = COALESCE($4, refresh_token),
                updated_at = now()
            WHERE user_id = $1
            """,
            self._row["user_id"],
            oauth.encrypt(new_access),
            new_expiry,
            oauth.encrypt(rotated) if rotated else None,
        )
        self._row["access_token"] = oauth.encrypt(new_access)
        self._row["access_token_expires_at"] = new_expiry
        if rotated:
            self._row["refresh_token"] = oauth.encrypt(rotated)
        return new_access

    # --- transport ----------------------------------------------------------

    async def _request(
        self, method: str, path: str, *, json: dict | None = None, retry_auth: bool = True
    ) -> dict | None:
        token = await self._access_token()
        url = f"{CALENDAR_API}{path}"
        last_error = "unknown error"

        for attempt in range(MAX_ATTEMPTS):
            self.api_calls += 1
            try:
                async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                    resp = await client.request(
                        method, url, json=json, headers={"Authorization": f"Bearer {token}"}
                    )
            except httpx.HTTPError as exc:
                last_error = f"network error: {exc}"
                await self._backoff(attempt, None)
                continue

            if resp.status_code in (200, 201):
                return resp.json() if resp.content else None

            if resp.status_code == 204:
                return None

            # 404/410 on patch/delete: the event is gone from Google. Callers
            # drop the link row and the next diff recreates it — idempotent.
            if resp.status_code in (404, 410):
                raise GoogleEventGoneError(f"{resp.status_code} on {path}")

            if resp.status_code == 401 and retry_auth:
                # Force a refresh, then retry exactly once.
                self._row["access_token_expires_at"] = None
                return await self._request(method, path, json=json, retry_auth=False)

            body = resp.text
            if resp.status_code == 403 and "insufficientPermissions" in body:
                raise GooglePermissionError(f"403 insufficientPermissions on {path}: {body}")

            retryable = resp.status_code in RETRY_STATUSES or (
                resp.status_code == 403 and ("rateLimitExceeded" in body or "userRateLimit" in body)
            )
            last_error = f"{resp.status_code} on {path}: {body[:400]}"
            if not retryable:
                raise GoogleCalendarError(last_error)

            await self._backoff(attempt, resp.headers.get("Retry-After"))

        raise GoogleCalendarError(f"gave up after {MAX_ATTEMPTS} attempts — {last_error}")

    @staticmethod
    async def _backoff(attempt: int, retry_after: str | None) -> None:
        if retry_after:
            try:
                await asyncio.sleep(min(float(retry_after), 30.0))
                return
            except ValueError:
                pass
        # 0.5, 1, 2, 4 seconds plus jitter so parallel users don't resonate.
        await asyncio.sleep(0.5 * (2**attempt) + random.uniform(0, 0.3))

    # --- endpoints ----------------------------------------------------------

    async def create_calendar(self, summary: str, tz_str: str) -> str:
        data = await self._request(
            "POST", "/calendars", json={"summary": summary, "timeZone": tz_str}
        )
        return data["id"]

    async def show_in_calendar_list(self, calendar_id: str, color: str = "#1d4ed8") -> None:
        """Make the calendar visible and brand-coloured in Google's own UI.

        Note this does NOT enable sync/notifications in the Google Calendar
        mobile app — that is a per-calendar setting only reachable on the
        phone.
        """
        try:
            await self._request(
                "PUT",
                f"/users/me/calendarList/{calendar_id}?colorRgbFormat=true",
                json={"selected": True, "backgroundColor": color, "foregroundColor": "#ffffff"},
            )
        except (GoogleCalendarError, GoogleEventGoneError):
            # Cosmetic only. Never fail a connect over it.
            pass

    async def insert_event(self, calendar_id: str, body: dict) -> str:
        data = await self._request("POST", f"/calendars/{calendar_id}/events", json=body)
        return data["id"]

    async def patch_event(self, calendar_id: str, event_id: str, body: dict) -> None:
        await self._request("PATCH", f"/calendars/{calendar_id}/events/{event_id}", json=body)

    async def delete_event(self, calendar_id: str, event_id: str) -> None:
        await self._request("DELETE", f"/calendars/{calendar_id}/events/{event_id}")
