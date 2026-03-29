Alright, here's the full brainstorm for the **Kahalany.Dev Client Portal**. Let's think through everything.

---

## Client Portal — Architecture & Vision

### The Big Picture

Right now you have:
```
kahalany.dev          → public portfolio (attract clients)
kahalany.dev/admin    → internal admin (you + staff)
```

You'd add:
```
kahalany.dev/portal   → client-facing portal (your clients log in here)
```

All three share the same backend, same database, same auth system — but with **role-based access**. Admins see everything, clients only see their own projects.

---

### Role System

```
Roles:
  admin     → full access (current system)
  staff     → like admin but scoped (can't delete other admins, etc.)
  client    → sees only their own projects, tickets, files
```

Each user gets a role. Clients are tied to one or more **projects**. Staff members can be assigned to projects too, so everyone on a project sees the same context.

---

### Core Data Model

```
organizations          → client companies (e.g., "PCG")
  ├── id, name, logo, primary_contact_email
  └── created_at

projects               → one org can have multiple projects
  ├── id, org_id, name, description, status
  ├── start_date, target_date, completed_date
  ├── progress_percent (0-100)
  └── created_at

project_members        → who can see/interact with a project
  ├── project_id, user_id, role (owner|member|viewer)
  └── added_at

milestones             → major project phases
  ├── id, project_id, title, description
  ├── status (upcoming|in_progress|completed)
  ├── target_date, completed_date
  └── sort_order

tickets                → the core communication unit
  ├── id, project_id, created_by (user_id)
  ├── assigned_to (user_id, nullable)
  ├── type (task|bug|feature_request|maintenance|question)
  ├── priority (low|medium|high|urgent)
  ├── status (open|in_progress|review|completed|closed)
  ├── title, description
  ├── due_date
  └── created_at, updated_at, closed_at

ticket_comments        → threaded discussion on tickets
  ├── id, ticket_id, user_id
  ├── body (markdown)
  ├── is_internal (boolean — admin/staff only, hidden from client)
  └── created_at

ticket_attachments     → files on tickets
  ├── id, ticket_id, uploaded_by
  ├── filename, mimetype, size, path
  └── uploaded_at

activity_log           → everything that happens
  ├── id, project_id, user_id
  ├── action (ticket_created, status_changed, comment_added, file_uploaded, milestone_completed, etc.)
  ├── entity_type, entity_id
  ├── details (JSON — old/new values, etc.)
  └── created_at
```

---

### What Clients See (Portal View)

**Dashboard** (`/portal`)
- Their project(s) — name, status, progress bar
- Recent activity feed ("Ohav completed milestone: Backend API")
- Open tickets count, any tickets needing their response
- Next milestone with target date

**Project View** (`/portal/project/:id`)
- Progress bar + milestone timeline (visual — like a Gantt-lite)
- Current phase highlighted
- List of milestones with status indicators

**Tickets** (`/portal/project/:id/tickets`)
- Client can **create** new tickets (request changes, report bugs, ask questions)
- Client can **comment** on existing tickets
- Client can **attach files** (screenshots, docs, design assets)
- Filter by status, type, priority
- Status changes are visible (they see when you pick it up, when it's in review, when it's done)

**Activity Feed** (`/portal/project/:id/activity`)
- Chronological log of everything (filtered — no internal comments)
- "Ohav marked ticket #12 as completed"
- "New milestone achieved: Phase 2 — Frontend Build"

---

### What Admins/Staff See (Admin View)

**All Projects Overview** (`/admin` → new section)
- Card per active project: client name, progress, open tickets, last activity
- Quick filters: active, completed, on hold

**Project Management** (`/admin/project/:id`)
- Everything the client sees PLUS:
  - **Internal comments** (marked with a flag, hidden from client)
  - **Time tracking** per ticket (optional — log hours)
  - **Edit milestones** — drag to reorder, change dates, mark complete
  - **Manage members** — add/remove staff, invite client users

**Ticket Management**
- Assign tickets to staff members
- Set priority, due dates
- Internal notes that clients never see (critical for "this client is being difficult about X" or "check with Y before responding")
- Bulk actions (close multiple, reassign)

**Client Management** (`/admin/clients`)
- List of all organizations
- Add new client/org → invite link or create login for them
- See all their projects, billing status, engagement metrics

---

### Communication Flow

```
Client creates ticket
  → Admin gets notification (in-app, optionally email)
  → Admin assigns to staff member
  → Staff works on it, posts internal note
  → Staff posts public comment ("Done — here's what we changed")
  → Client sees update, can respond
  → Admin closes ticket when resolved
  → Activity log captures everything
```

The key insight: **internal comments** let your team discuss privately before responding to the client. The client only sees public comments and status changes.

---

### Notification System

Start simple, expand later:

**Phase 1 (MVP):**
- In-app notification badge (unread count in nav)
- Activity feed with "new" indicators

**Phase 2:**
- Email notifications (configurable per user):
  - Client: "Your ticket was updated", "New milestone reached"
  - Admin/Staff: "New ticket created", "Client commented"
- Use a service like Resend or SendGrid (free tier is plenty)

**Phase 3:**
- Slack/Discord webhook integration for your internal team
- Daily digest emails for clients

---

### Claude AI Integration

This is the really interesting part. Here's how Claude fits in:

**1. Context Pull (the "side listener")**
When you're working on a project and open Claude Code, it can:
- Read the project's ticket history
- Read the activity log
- Read internal notes
- Understand what's blocked, what's in progress, what the client is asking for

This happens via the existing `PROGRESS.md` / `CLAUDE.md` pattern you already use — but now the portal data is an additional context source.

**Implementation:** An API endpoint like `GET /api/portal/project/:id/context` that returns a structured summary:
```json
{
  "project": { "name": "PCG Website", "status": "in_progress", "progress": 45 },
  "open_tickets": [ { "id": 12, "title": "Add contact form", "priority": "high", "comments": [...] } ],
  "recent_activity": [...],
  "milestones": [...],
  "blocked_items": [...]
}
```

Claude can call this endpoint (or you build a small CLI tool / MCP server that fetches it) to get full context before helping you code.

**2. Ticket Summarization**
Long ticket threads get messy. Claude can:
- Summarize a ticket's full history into a concise brief
- Extract the actual ask from a rambling client message
- Identify action items from a comment thread

**3. Smart Ticket Creation (future)**
Client describes an issue in plain language → Claude suggests:
- Type (bug vs feature request)
- Priority
- Which milestone it relates to
- Whether a similar ticket already exists

---

### PCG as Pilot

Perfect first test case because:
- You already have the relationship
- Real project with real needs
- You'll see immediately what's missing

**What to set up for PCG:**
1. Create org "PCG" with their project
2. Define milestones matching their actual project phases
3. Invite their point of contact as a client user
4. Create a few initial tickets from your existing conversation/notes
5. Let them start using it and collect feedback

---

### Staff Management

```
Staff member capabilities:
  - See all projects they're assigned to
  - Create/edit/close tickets
  - Post public and internal comments
  - Update milestone status
  - Log time (optional)
  - Cannot: manage other users, delete projects, access analytics/security
```

This means as you grow, you can add developers and they see exactly what they need — no more, no less.

---

### Technical Implementation Plan

**Phase 1 — Foundation (build this first)**
- Extend the `users` table with roles (admin/staff/client)
- Add `organizations`, `projects`, `project_members` tables
- Add `tickets`, `ticket_comments`, `ticket_attachments` tables
- Add `activity_log` table
- Build the portal SPA (same pattern as admin — vanilla JS, hash routing)
- Client login, dashboard, project view, ticket CRUD

**Phase 2 — Admin Integration**
- Add project management to admin panel (new sidebar section)
- Ticket assignment, internal comments
- Client/org management page
- Milestone management with progress tracking

**Phase 3 — Polish & Notifications**
- Email notifications (Resend/SendGrid)
- File upload handling (store in `data/uploads/`, serve with auth check)
- Activity feed with real-time feel (polling every 30s or WebSocket)

**Phase 4 — AI Integration**
- API endpoint for Claude context pull
- MCP server or CLI tool for Claude Code to query portal data
- Ticket summarization endpoint

**Phase 5 — Scale Features**
- Time tracking per ticket
- Recurring maintenance tickets (e.g., "monthly WordPress updates")
- Invoice/billing integration (connect to Stripe or just track manually)
- Client satisfaction surveys after ticket closure
- Knowledge base / FAQ per project

---

### URL Structure

```
/portal                          → client dashboard (their projects)
/portal/project/:id              → project overview + milestones
/portal/project/:id/tickets      → ticket list
/portal/project/:id/tickets/new  → create ticket
/portal/project/:id/tickets/:id  → ticket detail + comments
/portal/project/:id/activity     → activity feed

/admin/projects                  → all projects (admin view)
/admin/projects/:id              → project management
/admin/clients                   → client/org management
```

All rendered by the same Express server, same auth system — just different SPA bundles and role checks.

---

### What This Gets You

1. **Client retention** — clients have a reason to keep coming back, not just during the build
2. **Maintenance revenue** — ongoing tickets = ongoing relationship = ongoing income
3. **Team scaling** — when you add developers, everyone's in sync
4. **Professional image** — clients see a polished portal, not email threads and Slack messages
5. **AI-powered workflow** — Claude has full context of every project, every ticket, every conversation
6. **Accountability** — everything is logged, timestamped, and visible

---

What do you think? Want to start building Phase 1, or do you want to dig deeper into any specific area first?