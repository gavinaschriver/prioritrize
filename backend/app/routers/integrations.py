from urllib.parse import urlencode

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.auth import get_current_user
from app.config import settings
from app.database import get_conn
from app.models.integrations import (
    GoogleConnectOut,
    GoogleConnectRequest,
    GoogleConnectionOut,
    GoogleSettingsUpdate,
    SyncResultOut,
)
from app.services import calendar_sync_service, google_oauth_service as oauth

router = APIRouter(prefix="/api/integrations/google", tags=["integrations"])


@router.get("", response_model=GoogleConnectionOut)
async def get_google_connection(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Status for the Settings page. Never returns tokens."""
    row = await oauth.get_connection(conn, user["id"])
    if row is None:
        return GoogleConnectionOut(connected=False)

    count = await conn.fetchval(
        "SELECT count(*) FROM google_calendar_event WHERE user_id = $1",
        oauth.to_uuid(user["id"]),
    )
    return GoogleConnectionOut(
        connected=True,
        status=row["status"],
        google_account_email=row["google_account_email"],
        calendar_id=row["calendar_id"],
        timezone=row["timezone"],
        default_hour=row["default_hour"],
        default_duration_minutes=row["default_duration_minutes"],
        reminder_minutes=list(row["reminder_minutes"]),
        roll_forward=row["roll_forward"],
        last_synced_at=row["last_synced_at"],
        last_error=row["last_error"],
        synced_event_count=count or 0,
    )


@router.post("/connect", response_model=GoogleConnectOut)
async def start_google_connect(
    data: GoogleConnectRequest,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    url = await oauth.start_authorization(conn, user["id"], data.timezone, data.redirect_path)
    return GoogleConnectOut(authorization_url=url)


@router.get("/callback")
async def google_callback(
    state: str = Query(default=""),
    code: str = Query(default=""),
    error: str = Query(default=""),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Google's redirect target.

    Deliberately has NO get_current_user dependency: this is a top-level
    browser navigation with no Authorization header, and the frontend is on a
    different origin so there is no usable cookie either. The user identity
    comes from the single-use state row instead.
    """
    # Consume the state first so a replayed callback cannot do anything, and so
    # we know where to send the browser back to.
    row = await oauth.consume_state(conn, state) if state else None
    redirect_path = row["redirect_path"] if row else "/settings"

    def back(**params) -> RedirectResponse:
        return RedirectResponse(
            url=f"{settings.frontend_url}{redirect_path}?{urlencode(params)}", status_code=302
        )

    if error:
        return back(google="error", reason=error)
    if row is None:
        return back(google="error", reason="expired_state")
    if not code:
        return back(google="error", reason="missing_code")

    user_id = str(row["user_id"])
    try:
        payload = await oauth.exchange_code(code, row["code_verifier"])
        access_token = payload.get("access_token")
        if not payload.get("refresh_token"):
            # Only happens if prompt=consent was dropped from the auth URL.
            # Without a refresh token the connection is unusable, so refuse it
            # rather than storing something that dies in an hour.
            return back(google="error", reason="no_refresh_token")

        email = await oauth.fetch_account_email(access_token) if access_token else None
        await oauth.upsert_connection(conn, user_id, payload, row["timezone"], email)
    except HTTPException as exc:
        return back(google="error", reason=str(exc.detail)[:200])
    except Exception as exc:  # noqa: BLE001 - never leave the user on a blank page
        return back(google="error", reason=f"{type(exc).__name__}: {exc}"[:200])

    # First full sync: creates the calendar and populates it. Done inline so the
    # user lands on a page that already shows a populated calendar.
    result = await calendar_sync_service.sync_user(conn, user_id)
    if not result["synced"]:
        return back(google="connected_with_errors", reason=(result["error"] or "sync_failed")[:200])
    return back(google="connected")


@router.put("/settings", response_model=GoogleConnectionOut)
async def update_google_settings(
    data: GoogleSettingsUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    row = await oauth.get_connection(conn, user["id"])
    if row is None:
        raise HTTPException(status_code=404, detail="Google Calendar is not connected")

    updates = data.model_dump(exclude_unset=True)
    updates = {k: v for k, v in updates.items() if v is not None}
    if updates:
        set_clauses = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(updates))
        await conn.execute(
            f"UPDATE google_calendar_connection SET {set_clauses}, updated_at = now() WHERE user_id = $1",
            oauth.to_uuid(user["id"]), *updates.values(),
        )
        # Settings change every event body, so re-sync to apply them.
        await calendar_sync_service.sync_user(conn, user["id"])

    return await get_google_connection(user=user, conn=conn)


@router.post("/sync", response_model=SyncResultOut)
async def sync_now(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    row = await oauth.get_connection(conn, user["id"])
    if row is None:
        raise HTTPException(status_code=404, detail="Google Calendar is not connected")
    return SyncResultOut(**await calendar_sync_service.sync_user(conn, user["id"]))


@router.delete("")
async def disconnect_google(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Revokes the token and forgets the connection.

    The calendar itself is deliberately left in place: completed events are the
    record of what got finished when, and destroying them is not recoverable.
    Delete it from Google's own UI if you want it gone.
    """
    row = await oauth.get_connection(conn, user["id"])
    if row is None:
        return {"disconnected": True}

    token = oauth.decrypt(row["refresh_token"]) or oauth.decrypt(row["access_token"])
    if token:
        await oauth.revoke(token)
    await oauth.delete_connection(conn, user["id"])
    # A JSON body, not 204: frontend/src/lib/api.ts calls res.json() on every verb.
    return {"disconnected": True, "calendar_kept": True}


@router.post("/sync/reconcile")
async def reconcile_all(
    x_cron_secret: str = Header(default=""),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Nightly cron entry point. Rolls events forward for every connected user
    on the days nobody opens the app."""
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=401, detail="Invalid cron secret")
    return await calendar_sync_service.sync_all_users(conn)
