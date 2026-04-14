# GTD System — Design Spec

## Background: Getting Things Done in one page

GTD is a personal productivity methodology created by David Allen. Its core
premise: your mind is for *having* ideas, not *holding* them. By externalizing
commitments into a trusted system, you free mental bandwidth for focused work.

### The Five Steps

1. **Capture** — Collect anything that has your attention into "inboxes." No
   filtering, no judgment.
2. **Clarify** — Process each inbox item: Is it actionable?
   - *No* → Trash, Someday/Maybe, or Reference.
   - *Yes* → Decide the next physical action. If it takes <2 minutes, do it
     now. Otherwise delegate or defer.
3. **Organize** — Put items where they belong: Next Actions (by context),
   Projects, Waiting For, Calendar, Someday/Maybe, Reference.
4. **Reflect** — Review the system regularly. The **Weekly Review** is sacred.
5. **Engage** — Choose what to do based on context, time, energy, and priority.

### Key Concepts

- **Next Action**: The very next physical, visible step. Not "plan vacation"
  but "email travel agent for quotes."
- **Project**: Any outcome needing more than one action step. Projects don't
  get "done" — their next actions do.
- **Contexts**: Tags representing where/how an action can be performed
  (`@computer`, `@phone`, `@errands`).
- **Horizons of Focus**: Ground → Projects → Areas of Focus → Goals → Vision →
  Purpose.

---

## Goal

A single-user app that operationalizes GTD's five steps with low-friction
capture and a frictionless weekly review. Must be usable from a phone browser.

## Core Entities

| Entity          | Key Fields |
|-----------------|-----------|
| **InboxItem**   | id, raw_text, created_at |
| **Action**      | id, title, notes, status (next/waiting/done/someday), context_id, project_id, delegated_to, due_date, created_at, completed_at |
| **Project**     | id, title, outcome, status (active/on_hold/complete/someday), created_at, completed_at |
| **Context**     | id, name (`@computer`, `@phone`, …) |
| **ReferenceItem** | id, title, body, created_at |
| **ReviewLog**   | id, kind (weekly/daily), completed_at, notes |

## Functional Requirements

### 1. Capture
- Global quick-add from anywhere in the app.
- Bulk capture (one item per line).
- Zero required fields beyond raw text; everything lands in Inbox.

### 2. Clarify
- Sequential "one-at-a-time" inbox processor.
- Per item, the user answers *What is it?* with branches to:
  - Next action (with context, project, due date)
  - 2-minute rule (immediate done)
  - Waiting for (with delegated_to + follow-up)
  - New project (with outcome + first next action)
  - Someday/Maybe
  - Reference
  - Trash
- "Skip for now" rotates the item to the back of the queue.

### 3. Organize
- Next Actions list filterable by context.
- Projects view: each project shows its actions and warns if no `next` action exists.
- Waiting For list with delegate/follow-up metadata.
- Someday/Maybe shelf with one-click activation.
- Reference shelf.

### 4. Reflect
- **Weekly Review wizard** — guided checklist:
  1. Process inbox to zero
  2. Review every active project → confirm a next action
  3. Review Waiting For
  4. Review Someday/Maybe
  5. Review calendar (past week + upcoming 2 weeks)
  6. Review goals / areas / loose ends
- Stale-project detector flags active projects with no next action.
- Review log records each completed review with timestamp + notes.

### 5. Engage
- Context-filtered next-actions view is the default "what do I do now?" surface.
- Due-dated actions sort first.

## Non-Functional Requirements

- **Offline-first**: SQLite, no external services.
- **Sub-second capture** latency.
- **Mobile-first** capture UI; works from any phone browser.
- **Data portability**: SQLite file is the source of truth; trivially
  exportable.

## Tech Choices

- **Frontend + backend**: Streamlit (single deployable app).
- **Persistence**: SQLite via stdlib `sqlite3`.
- **Schema migrations**: `CREATE TABLE IF NOT EXISTS` (sufficient for v1).
- **Config**: `GTD_DB_PATH` env var overrides default DB location.

## MVP Scope (v1 — what's implemented)

1. Inbox capture (single + bulk).
2. Clarify flow with all six outcomes + 2-minute rule.
3. Actions with contexts, projects, due dates, delegated-to.
4. Next-actions list filtered by context.
5. Projects view with next-action warnings.
6. Waiting For list.
7. Someday/Maybe + Reference.
8. Weekly Review checklist with review log.

## Out of Scope (v1)

- Authentication / multi-user
- Collaboration / shared projects
- Calendar integration (CalDAV/Google)
- Email-to-inbox ingestion
- Voice capture / AI auto-categorization
- Mobile native apps (browser only)
- Full-text search
- Recurring actions

## Future Ideas

- Sync via Litestream or a remote Postgres backend.
- Quick-add from iOS/Android share sheets (via a lightweight HTTP endpoint).
- Tagging beyond contexts (energy, time estimate).
- "Engage" view that filters by context + time available + energy.
- Horizons of Focus (areas / goals / vision).

## Success Metrics

- Time-to-capture < 3 seconds from intent to saved.
- % of inbox items processed within 24h.
- Weekly reviews completed per user per month.
- Active projects with a defined next action (target: 100%).
