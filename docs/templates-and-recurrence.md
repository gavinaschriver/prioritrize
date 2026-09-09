# Templates & Recurring Todos

Two problems, one mechanism:

- **Repetitive but irregular** — "submit pelvic PT superbill claim" comes up often
  enough to hate retyping, on no predictable schedule.
- **Repetitive and scheduled** — "take out the trash" every Friday.

## One entity, not two

A recurring todo *is* a template that instantiates itself, so both are rows in
`item_template`, separated by one nullable column:

| `repeat_every_days` | Behaviour |
|---|---|
| `NULL` | Manual template. Waits in the tracker's **+ Template** dropdown. |
| `7` | Generates itself every 7 days from `starts_on`. |

The binary choice on the todo form is literally this column being null or not.

## Why a separate table, not `is_template` on `todo`

The flag is the smaller migration and the larger change. `compute_day_score`,
`get_balance`, `list_todos`, `ref_service.resolve`, the dashboard, and the
read-only MCP server all `SELECT` from `todo` directly. A blueprint leaking into
any one of them would silently dock points or consume a `#NNNN`, and every one of
them — including the ones not written yet — would have to carry an
`AND NOT is_template` correctly, forever.

The only change to an existing table is `todo.template_id`: provenance,
`ON DELETE SET NULL`, read by nothing in scoring.

## No weekday or day-of-month fields

The whole schedule is an interval plus an anchor. "Every Friday" is
`repeat_every_days = 7` with `starts_on` on a Friday — same dates, and the date
picker already answers *which* Friday. This removed a weekday-set column, a
day-of-month column, month-end clamping, off-week arithmetic, and four validation
rules.

What it deliberately **cannot** express is calendar-month recurrence ("the 1st of
every month"), because months are 28–31 days and no day interval lands on the 1st
twice running. Nothing needs that yet. When something does, it is another nullable
column, not a redesign.

## Generation happens on read, not on a schedule

There is no cron anywhere in this app — not in `vercel.json`, `fly.toml`,
`.github/workflows/`, `pg_cron`, or the FastAPI lifespan. A server-side one would
be *worse* than none, because it could not know the user's timezone.

So `GET /api/days/summary` calls `template_service.materialize_due_recurrences`
before scoring, exactly as it already calls `scoring_service.backfill_snapshots`,
and `create_template` calls it too so a new schedule is visible at once. The
timezone arrives on every request as `X-Timezone`.

The consequence, stated plainly: **recurring items appear when you open the app.**

### Why this can't corrupt a past day

`compute_day_score` filters todos by `created_at < <the day's end>`. Anything
generated today has `created_at = now()`, so it cannot appear on — or alter — a
finalized past day, no matter what due date it carries.

## It looks forward, like a calendar

`next_occurrence` returns the next date a series should produce something, and
**never a date in the past**. A schedule saved on a Wednesday for "every Saturday"
puts Saturday's todo in the queue immediately, dated Saturday — the way adding a
recurring calendar event shows you the next one straight away, rather than
ambushing you on the day. `create_template` runs the generator itself for exactly
this reason, so saving a schedule visibly does something.

An occurrence with a future due date scores nothing: `_deadline_score` returns
`(0, is_upcoming=True)` while `due_date > the day being scored`. It just sits in
the queue, like any hand-typed todo with a date on it.

## One open occurrence per series

While an instance is open, nothing new is made. An unfinished chore simply goes
overdue; the moment it is completed, the following occurrence appears.

That single rule plus the never-look-back floor gives three properties without any
special cases:

- **No debt.** Two weeks away owes you the next trash-taking, not the two you
  missed. Missed occurrences aren't skipped by special-case code — they were never
  candidates, because `next_occurrence` floors at today. This matters because
  `_deadline_score` docks `-point_value` for *every* day from `due_date` onward, so
  three backfilled occurrences would dock the day you returned three times.
- **No duplicates.** The queue never fills with identical rows.
- **Idempotence.** Safe to call on every page load, which is what happens. Two
  guards enforce it: the open-instance check, and `next_occurrence` flooring at
  `last_materialized_on + 1` so a completed occurrence is never re-made.

`last_materialized_on` therefore names *the occurrence currently in your queue*,
not a historical high-water mark — which is why the manage list shows it as
"due Sat, Sep 12" rather than computing an interval ahead of it.

## Map

| Layer | File |
|---|---|
| Schema | `supabase/migrations/20260908000000_add_item_templates.sql` |
| Models | `backend/app/models/item_template.py` |
| Service | `backend/app/services/template_service.py` |
| Routes | `backend/app/routers/templates.py` (`/api/templates`) |
| Hook point | `backend/app/routers/days.py` → `day_summary` |
| Tests | `backend/tests/test_recurrence.py` |
| Types & data | `frontend/src/types/index.ts`, `frontend/src/hooks/useTemplates.ts` |
| Create UI | `frontend/src/components/prioritry-manage/TodoForm.tsx`, `ScheduleFields.tsx` |
| Add UI | `frontend/src/components/day-tracker/AddFromTemplate.tsx` |
| Manage UI | `frontend/src/components/prioritry-manage/TemplateList.tsx` |
| Task templates | `frontend/src/pages/ProjectDetailPage.tsx` → `TasksSection` |

`instantiate` and `materialize_due_recurrences` both build through
`todo_service.create_todo` / `project_service.create_task` rather than their own
INSERT, so a generated item is indistinguishable from a hand-typed one: same
ownership checks, same `#NNNN` from `ref_counter`, same everything scoring reads.

---

# Enabling recurring project tasks

Task **templates** already work. Task **recurrence** is blocked by one constraint.

The motivating case: *"prune suckers on fruiting plants"* every 14 days under a
**Gardening '26** project.

## The mechanical part

1. Drop `item_template_recurrence_is_todo_only`, and the matching guard in
   `TemplateCreate._kind_matches_project`.
2. Add `project_task.template_id` mirroring `todo.template_id`, plus the partial
   index on open rows:
   ```sql
   ALTER TABLE project_task ADD COLUMN template_id UUID NULL
       REFERENCES item_template(id) ON DELETE SET NULL;
   CREATE INDEX idx_project_task_open_by_template ON project_task(template_id)
       WHERE completed_at IS NULL;
   ```
3. In `materialize_due_recurrences`, branch on `t.kind` and call
   `project_service.create_task`. The open-instance check has to query whichever
   table matches the kind.
4. In `TodoForm`'s task counterpart (`TasksSection`), promote the single
   "Save as template" checkbox to the same pair the todo form uses, and render
   `ScheduleFields`.

That is perhaps an hour. The reason this document exists is step 5.

## The decisions it forces

These have no obvious right answer and should be settled deliberately, not
discovered in production:

**What happens when the parent project completes?** A completed project that keeps
sprouting new tasks cannot stay completed. Options: stop generating (probably
right), un-complete the project, or let it generate and accept that "completed"
means "completed as of then". Whichever is chosen, `materialize_due_recurrences`
needs to join `project` and check `completed_at` — it currently does not.

**What happens when the project is deleted?** `item_template.project_id` is
`ON DELETE CASCADE` today, so deleting the project takes its templates with it.
That is probably right for a task template — the blueprint names a project that no
longer exists — but it is the *opposite* of how `todo.template_id` and
`category_id` behave, and it is worth re-confirming rather than inheriting.

**Does an endlessly self-refilling task list break what a project is?** Projects
have `completed_at`, roll up into deadline scoring, and read as things you finish.
A perpetual chore attached to one may be a sign it wanted to be a todo with a
category. Worth asking before building, because "convert todo to task" already
exists (`todo_service.convert_to_task`) and may be the cheaper answer.

**Which project does a recurring task's instance land in?** Only the template's own
`project_id` today. If **Gardening '26** becomes **Gardening '27**, every schedule
under it needs re-pointing by hand, or `project_id` needs to become editable on a
template — which it deliberately is not, since a template that changed what it
builds would orphan the instances it already made.
