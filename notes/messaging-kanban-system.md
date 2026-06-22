# Dex Communication & Submissions Pipeline — Design Plan

> Status: **proposal / living doc**. Captures the target design for (1) kanban-ing
> submissions from any intake form and (2) two-way user↔Dex communication.
> Grounded in what exists today so it can be built incrementally.

## 1. What exists today (baseline)

**Submissions** (`dex-api/src/handlers/submissions.ts`, `lib/submissions-store.ts`)
- A real pipeline already exists. `STAGE_FLOW`:
  `sent → received → acknowledged → reviewing → accepted | rejected → in_library`.
- Each submission is a **thread** (`submission_threads`) with a **timeline** of
  events (`submission_events`: type, stage, status, public/internal notes, time).
- Ops can reply + set status (`ops.reply`, `ops.patch`) — i.e. internal notes vs
  public notes already exist conceptually.

**Messages** (`handlers/messages.ts`, `lib/messages-store.ts`)
- One-way **system notifications** only: `system_messages` (source_type, category,
  severity, title, body, href, read_at, archived_at, expires_at) + `digest_outbox`
  (batched email via Resend). Site inbox at `/entry/messages/`.
- **Gap:** there is no user→Dex reply path, and notifications are not linked to the
  submission thread that produced them.

**Ops app** (`dex-cli/desktop`)
- `Submissions` screen = a list + a ticket detail with reply + status. `Polls`,
  `Profiles`, `Users`. No board/kanban view; no unified "conversation" view.

**The core problem:** submissions, ops tickets (`ops.*` press/board), and member
notifications are three parallel silos. There is no single place to (a) see the
queue as a board, (b) hold a real back-and-forth with the submitter, and (c) have
the member see that same conversation on the site.

---

## 2. Target model — one **Thread** primitive

Unify everything into a single conversation primitive. A **Thread** has:

```
Thread
  id
  kind            submission | press | board | direct        (intake source)
  subject
  member_sub      auth0 sub (nullable for anonymous intake; link on claim/login)
  email           contact email (for anon + email replies)
  stage           sent…in_library  (submission) | open/triaged/closed (ops/direct)
  status_label    freeform display ("Reviewing", "Needs files")
  priority        low | normal | high
  assignee        staff id (nullable)
  entry_lookup    optional link to a catalog entry
  tags[]          e.g. instrument, season, "needs-revision"
  last_activity_at, created_at, sla_due_at
Message (timeline item)  — replaces submission_events + system_messages
  thread_id
  author          system | staff:<id> | member
  visibility      public (member sees) | internal (ops only)
  kind            note | stage_change | status_change | file_request | decision
  body            markdown-lite
  meta_json       { from_stage, to_stage, attachments[], template_id, … }
  created_at, read_by_member_at
```

Key moves:
- `submission_events` ⊇ becomes `messages` (it already carries public/internal +
  stage). `system_messages` becomes a **projection**: a member's inbox = the
  `public` messages across their threads, plus standalone announcements.
- A reply from the member is just a `message` with `author=member, visibility=public`.
- Notifications/digests are generated from new `public` messages (reuse
  `digest_outbox` + Resend).

This keeps the existing submission stage machine intact and layers messaging on top
rather than replacing it.

---

## 3. Backend plan

1. **Schema**
   - Add `thread_messages` (the unified timeline) or extend `submission_events`
     with `author`, `visibility`, `kind`, `read_by_member_at`. Backfill existing
     events as `author=staff/system, visibility` derived from public/internal note.
   - Add to `submission_threads`: `assignee`, `priority`, `tags_json`, `sla_due_at`,
     `last_activity_at`. (Ops tickets table gets the same or is merged in.)
   - Member inbox view = `SELECT public messages WHERE thread.member_sub = ?`
     UNION standalone `system_messages` announcements.

2. **Endpoints**
   - `GET /admin/threads?stage=&kind=&assignee=&q=&priority=` → board data
     (grouped by stage) — powers the kanban.
   - `PATCH /admin/threads/:id` → stage/assignee/priority/tags (one call; drag-drop
     on the board hits this).
   - `POST /admin/threads/:id/messages` → staff reply (`visibility`, optional
     `template_id`, optional `stage` change in the same call).
   - Member side: `GET /me/threads`, `GET /me/threads/:id`,
     `POST /me/threads/:id/messages` (member reply), `POST /me/threads/:id/read`.
   - Anonymous intake replies via signed email links (token) so submitters without
     an account can still respond → later linked on login.

3. **Notifications**
   - On every new `public` message, enqueue a `digest_outbox` row + bump inbox
     unread. Respect notification preferences (already exists).
   - Email replies (inbound) via a Resend inbound route → append as member message.

4. **Macros / templates**
   - A small server-side template table (`message_templates`) with variables
     ({{lookup}}, {{name}}, {{stage}}) so staff can insert "Needs higher-res files",
     "Accepted — scheduling", etc. with one click. Drives consistency + SLA speed.

---

## 4. Ops app plan — Kanban + Conversation

**A. Board view (new default for Submissions)**
- Columns = stages (`received → acknowledged → reviewing → accepted → in_library`,
  with `rejected` as a collapsible column). Cards = threads.
- **Card anatomy:** subject + lookup, submitter (name/handle/email), age + SLA pill
  (green/amber/red), priority flag, assignee avatar, unread-reply dot, tag chips.
- **Drag-drop** a card between columns → `PATCH stage` (optimistic, with the
  click-guard + Dex loader pattern already in the app). Confirm modal in prod.
- Filters: kind, assignee ("mine"), priority, season/instrument tag, search.
- Swimlanes (optional): by assignee or by kind.

**B. Thread detail (drawer/modal)**
- Left: **timeline** (messages, stage changes, decisions) with internal notes
  visually distinct (muted, "internal only" tag) from public ones.
- Right rail: metadata (submitter → link to `/u/…` + Users tab, entry link,
  priority, assignee, tags, SLA), and quick actions (advance stage, request files,
  accept/reject) that each post a templated public message.
- **Composer:** public reply vs internal note toggle, template picker, attach
  file-request checklist, "send + advance stage" combo.
- Everything mutating is optimistic + guarded + uses the lifted `DexLoader`.

**C. Inbox/triage for non-submission kinds** (press/board/direct) reuse the same
board with a different column set (`open → triaged → waiting → closed`).

---

## 5. User-facing site plan

- **Upgrade `/entry/messages/`** from a read-only notification list into a **two-way
  inbox**: thread list (left) + conversation (right) + reply composer. Each thread
  shows its submission **status timeline** (the existing stage rail) inline.
- **Submission status page** (`/entry/submit/` confirmation + a `/u` "My
  submissions" tab): the stage rail + latest public message, "you're here" marker,
  expected next step.
- **Notifications**: unread badge in the account menu (already partly wired via
  unread count) deep-links into the thread.
- Anonymous submitters: emailed magic links open a minimal thread view to reply.

**Saved component checklist (to revisit):**
- [ ] `dx-inbox` two-pane component (thread list + conversation + composer)
- [ ] `dx-thread-timeline` (reuse submission stage rail + message bubbles)
- [ ] account-menu unread badge → thread deep link
- [ ] `/u` "My submissions" tab (status rail per thread)
- [ ] inbound email → member message (Resend inbound)

---

## 6. Visual design language

- **Board:** glass columns on the gooey mesh; column header = stage label + count;
  cards are the existing `claim-card` surface with an accent left-border by
  priority. Status colors reuse the chips already defined
  (`status-approved/pending/rejected`). SLA pill: green < 50% of window, amber <
  100%, red overdue.
- **Conversation:** staff messages right-aligned accent, member left-aligned neutral,
  system/stage-change as centered pills ("→ Reviewing · 2d ago"). Internal notes get
  a hatched/muted background + lock icon so they're never confused with public.
- **Motion:** the lifted `DexLoader` for loads; optimistic card moves animate to the
  new column; toasts confirm. No click-and-pray (the guard mentality).

---

## 7. Workflow (end to end)

1. **Intake** (any form) → Thread created in `received`, auto-ack public message +
   email. SLA clock starts.
2. **Triage** → assignee + priority + tags; move to `acknowledged`/`reviewing`.
3. **Back-and-forth** → staff request files / ask questions (public messages,
   templates); member replies (site or email). Unread dots both directions.
4. **Decision** → `accepted`/`rejected` posts a templated public message; rejected
   can re-open.
5. **Library** → on `in_library`, the entry link is attached; the member's `/u`
   contributions reflect it; sidebar attribution syncs (ties into the existing
   public-profiles sync + dirty-guard).

---

## 8. Phasing — status

- **P1 (backend foundation): ✅ DONE.** submission_threads gained `assignee`,
  `priority`, `tags_json`, `sla_due_at`; events already carry author (`actor_type`)
  + visibility (public/internal) + kind (`event_type`). Endpoints:
  `GET /admin/threads` (board cards + stage flow), `GET /admin/threads/:id`
  (timeline), `PATCH /admin/threads/:id` (stage/assignee/priority/tags, records an
  internal stage-change event), `POST /admin/threads/:id/messages` (staff
  public/internal), `POST /me/submissions/:id/messages` (member reply, ownership
  checked). Admin-token auth via the ops token chain. *Needs worker deploy.*
- **P2 (ops board): ✅ DONE.** Dex Ops Studio → Submissions → **Board**: kanban
  columns by stage, draggable cards (HTML5 DnD → `PATCH stage`, optimistic), a
  thread drawer with the public/internal timeline (internal notes hatched + locked)
  and a reply composer, plus priority/assignee quick-edit. Lib `ops-admin-api.mjs`
  (`listAdminThreads`/`getAdminThread`/`patchAdminThread`/`postAdminThreadMessage`),
  bridge `threads.*`.
- **P3 (member two-way inbox): ◑ MOSTLY DONE.** Member reply endpoint (P1) + the
  submission timeline view (`messages.submission.entry.mjs`) now has a **reply
  composer** that POSTs `/me/submissions/:id/messages` and re-renders the timeline —
  it's two-way. Remaining: **inbound email** (needs a Resend inbound route + MX/DNS
  config + sender verification — infra, can't be done from code alone) and an
  optional dedicated "my submissions" index.
- **P4 (polish): ✅ DONE.** Board now has **SLA/aging pills** (fresh/warn/stale from
  last activity), a **search + priority filter** (persisted to localStorage),
  **swimlanes by assignee**, and **reply templates** in the thread composer.

## 9. Edge cases to design for

- Anonymous → linked member (merge threads on first login by matching email).
- Email reply spoofing → signed tokens, verify sender.
- Internal notes must NEVER leak to members (server-side visibility filter, never
  client-trimmed).
- Concurrent staff edits to the same thread (last-write-wins + activity feed).
- Stage regressions (rejected → reviewing) must be allowed + audited.
- Notification storms (batch via digest_outbox; per-thread coalescing).
- Deleted Auth0 user (Users tab) → orphan threads keep email contact.
- Drag-drop in prod → confirm + optimistic revert on failure (existing pattern).
