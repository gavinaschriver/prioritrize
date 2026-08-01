# PRIORI-TRIZE MCP server

Read-only MCP server over the app's Postgres database, so Claude can answer
questions like "what did I spend the most time on last month?" or "which daily
goals am I least consistent about?".

Runs locally over stdio. Registered in `../.mcp.json` (Claude Code) and
`~/Library/Application Support/Claude/claude_desktop_config.json` (Claude
Desktop). Both point at this directory's `.venv`, so no PATH setup is needed.

## Tools

| Tool | Purpose |
| --- | --- |
| `list_prioritries` | The catalog: type, points, timeblock, entry counts |
| `time_spent` | Rank prioritries by minutes logged over a range |
| `consistency` | Completion rate and streaks, worst first |
| `tag_breakdown` | Aggregate the `#tags` written in entry comments |
| `timeline` | Entries, minutes, and score per day/week/month |
| `day_detail` | One day in full: entries, todos, note, score |
| `search_text` | Substring search across notes, comments, updates, todos |
| `open_work` | Outstanding todos and projects |
| `describe_schema` | Column listing and query conventions |
| `run_sql` | Arbitrary read-only SQL for anything else |

Range arguments (`start`, `end`, `days`, `tz`) are optional everywhere; the
default is the last 30 days in the host timezone.

## Safety

Writes are impossible, and this is enforced by Postgres rather than by
inspecting SQL strings:

* Every query runs inside a `READ ONLY` transaction, so `INSERT`/`UPDATE`/
  `DELETE`/DDL raise `ReadOnlySQLTransactionError`.
* `run_sql` additionally drops to Supabase's `authenticated` role with
  `request.jwt.claims` set, so the app's existing RLS policies apply and other
  accounts' rows are invisible. The curated tools use the privileged connection
  because their SQL is fixed and always filters by `user_id`.
* `run_sql` is one statement per call and times out after 15 seconds.

## Two things that will silently corrupt results if changed

1. **Bucket days in local time.** `created_at` is UTC `timestamptz`. A bare
   `created_at::date` puts about a third of entries on the wrong day. Use
   `(created_at AT TIME ZONE $tz)::date`, or `db.local_day()`.
2. **Minutes are a floor, not a total.** Only some prioritries define a
   `timeblock`; the rest can only be counted by entry. Tools that report time
   list the excluded prioritries rather than quietly omitting them.

## Configuration

`DATABASE_URL` is read from `../backend/.env`. Optional overrides go in
`mcp-server/.env`:

```
PRIORITRIZE_USER_EMAIL=gavin.a.schriver@gmail.com
PRIORITRIZE_TZ=America/Chicago
```

The timezone defaults to the host's (`/etc/localtime`), and the account
defaults to the address above.

## Checks

Run from this directory with `.venv/bin/python`:

| Script | Verifies |
| --- | --- |
| `probe.py` | Database reachable; which accounts hold data |
| `check_db.py` | Config, read-only guard, local-day bucketing |
| `check_sql.py` | RLS isolation, write rejection, timeout |
| `smoke.py` | Every curated query against real data |
| `check_stdio.py` | Full client/server round trip over stdio |

`smoke.py` and `search_text` print real note and entry content — keep the
output local.

## Scope

This is a local stdio server, so it works in Claude Code and the Claude Desktop
app. It is not reachable from claude.ai or cowork, which need an HTTPS endpoint
with its own authentication.
