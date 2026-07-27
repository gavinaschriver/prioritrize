-- Google Calendar sync: one connection per user, one link row per synced item,
-- plus short-lived OAuth state rows that carry the Supabase user identity
-- through Google's redirect (the callback is a top-level navigation with no
-- Authorization header, and the frontend and API are on different origins).

CREATE TABLE google_calendar_connection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    google_account_email TEXT NULL,

    -- Fernet ciphertext, never plaintext. See TOKEN_ENCRYPTION_KEY.
    refresh_token TEXT NULL,
    access_token TEXT NULL,
    access_token_expires_at TIMESTAMPTZ NULL,
    scope TEXT NULL,

    -- The dedicated secondary calendar we create on connect.
    calendar_id TEXT NULL,

    -- Persisted, not read per-request: the nightly roll-forward job has no
    -- request to read Intl.DateTimeFormat().resolvedOptions().timeZone from.
    timezone TEXT NOT NULL DEFAULT 'UTC',

    default_hour INT NOT NULL DEFAULT 9 CHECK (default_hour BETWEEN 0 AND 23),
    default_duration_minutes INT NOT NULL DEFAULT 30 CHECK (default_duration_minutes > 0),
    reminder_minutes INT[] NOT NULL DEFAULT ARRAY[0, 30],
    roll_forward BOOLEAN NOT NULL DEFAULT TRUE,

    status TEXT NOT NULL DEFAULT 'connected'
        CHECK (status IN ('connected', 'needs_reauth', 'error')),
    last_error TEXT NULL,
    last_synced_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_google_calendar_connection_user_id ON google_calendar_connection(user_id);
CREATE INDEX idx_google_calendar_connection_status  ON google_calendar_connection(status);

ALTER TABLE google_calendar_connection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own google calendar connection" ON google_calendar_connection
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- Link table. No FK on item_id: it points at one of three source tables
-- depending on item_type. The whole-user reconcile sweeps orphans instead,
-- which is what makes project deletion safe — delete_project relies on
-- ON DELETE CASCADE to remove project_task rows, so the API never learns the
-- deleted task ids and could not clean their events up one at a time.
CREATE TABLE google_calendar_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('todo', 'project', 'project_task')),
    item_id UUID NOT NULL,

    calendar_id TEXT NOT NULL,
    google_event_id TEXT NOT NULL,

    -- Where the event currently sits. Load-bearing: when an item is completed
    -- its event must freeze exactly where it already is, and the reconcile
    -- computes each target body from scratch, so without this it would have to
    -- re-read every event from Google to know where "already is" was.
    event_start TIMESTAMPTZ NULL,

    -- sha256 of the canonical event body. Equal hash => no Google API call.
    content_hash TEXT NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX idx_google_calendar_event_user_id ON google_calendar_event(user_id);

ALTER TABLE google_calendar_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own google calendar events" ON google_calendar_event
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- Single-use CSRF/identity state. Consumed with a DELETE ... RETURNING, which
-- is atomic in one statement — this codebase uses no explicit transactions.
CREATE TABLE google_oauth_state (
    state TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_verifier TEXT NOT NULL,
    redirect_path TEXT NOT NULL DEFAULT '/settings',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '10 minutes'
);

CREATE INDEX idx_google_oauth_state_expires_at ON google_oauth_state(expires_at);

ALTER TABLE google_oauth_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own google oauth state" ON google_oauth_state
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- Deliberate deviation from the other tables. RLS already scopes rows by user,
-- but the PostgREST roles have no business reading token ciphertext or a live
-- PKCE verifier at all — every access goes through the API, which connects
-- with its own credentials.
REVOKE ALL ON google_calendar_connection FROM anon, authenticated;
REVOKE ALL ON google_oauth_state FROM anon, authenticated;
