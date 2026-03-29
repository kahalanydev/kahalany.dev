# Kahalany.Dev — Client Portal System Plan

> Comprehensive architecture, security model, Claude integration, and implementation roadmap for the client-facing project portal.

**Author**: Ohav Kahalany + Claude
**Date**: 2026-03-29
**Status**: Planning (not yet implemented)
**Related**: `APP-MAP.md`, `PROGRESS.md`, `USER-PORTAL.md`

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [System Architecture](#2-system-architecture)
3. [Security Model](#3-security-model)
4. [Data Model](#4-data-model)
5. [The Project Lifecycle](#5-the-project-lifecycle)
6. [Claude Code Integration](#6-claude-code-integration)
7. [Token Optimization Strategy](#7-token-optimization-strategy)
8. [Offline PC Handling](#8-offline-pc-handling)
9. [Client Portal (What Clients See)](#9-client-portal-what-clients-see)
10. [Admin Panel Extensions (What You See)](#10-admin-panel-extensions-what-you-see)
11. [API Specification](#11-api-specification)
12. [Notification System](#12-notification-system)
13. [File Upload & Storage](#13-file-upload--storage)
14. [Implementation Phases](#14-implementation-phases)
15. [PCG Pilot Plan](#15-pcg-pilot-plan)
16. [Future Enhancements](#16-future-enhancements)

---

## 1. Vision & Goals

### What We're Building

A client portal integrated into kahalany.dev that transforms Kahalany.Dev from a one-time build shop into an ongoing client engagement platform. Clients log in, see their project progress in real time, submit tickets for changes/bugs/requests, and communicate with us through a structured system — not scattered emails and messages.

### Core Goals

1. **Client visibility** — Clients see exactly where their project stands at all times
2. **Structured communication** — Every request, change, and conversation is tracked in tickets
3. **Staff sync** — As the team grows, everyone sees the same state across all projects
4. **Claude-powered development** — Claude Code reads project context from the portal, builds code, and reports progress back automatically
5. **Maintenance revenue** — Post-launch tickets keep the relationship (and income) going
6. **Accountability** — Everything is logged, timestamped, and auditable

### What This Is NOT

- Not a full project management tool (no Gantt charts, no resource allocation)
- Not a CRM (no lead tracking, no sales pipeline)
- Not a billing system (no invoices, no payment processing — though we may add manual tracking later)
- Not a replacement for direct communication (phone calls, meetings still happen — this supplements them)

---

## 2. System Architecture

### The Three Independent Systems

```
┌─────────────────────────────────────────────────────────────┐
│                    HETZNER VPS (178.156.245.71)              │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  kahalany.dev (Coolify container, port 8080)          │  │
│  │                                                       │  │
│  │  Express Server                                       │  │
│  │  ├── / .................. Public portfolio site        │  │
│  │  ├── /admin ............ Admin panel (existing)       │  │
│  │  ├── /portal ........... Client portal (NEW)          │  │
│  │  ├── /api/auth ......... Auth (existing, extended)    │  │
│  │  ├── /api/track ........ Analytics tracking (existing)│  │
│  │  ├── /api/admin ........ Admin data API (existing)    │  │
│  │  ├── /api/portal ....... Client portal API (NEW)      │  │
│  │  └── /api/dev .......... Dev machine API (NEW)        │  │
│  │                                                       │  │
│  │  SQLite Database (data/analytics.db)                  │  │
│  │  ├── Existing tables (visits, events, users, etc.)    │  │
│  │  └── New tables (orgs, projects, milestones, tickets) │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  This server runs 24/7. Clients always have access.         │
│  It NEVER depends on your PC being online.                  │
└─────────────────────────────────────────────────────────────┘

        ▲                              ▲
        │ HTTPS (public)               │ HTTPS (authenticated)
        │                              │
   Client browser               Your PC (when online)
   (portal login)                      │
                                       │
┌──────────────────────────────────────▼──────────────────────┐
│                    YOUR WINDOWS PC                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Claude-Code-Desk-Mobile (port 3141)                  │  │
│  │  ├── Existing: Claude CLI process pool                │  │
│  │  ├── Existing: Project scanning (C:\KDEV\*)           │  │
│  │  ├── Existing: CF Tunnel → code.kahalany.dev          │  │
│  │  ├── NEW: Portal sync service                         │  │
│  │  │   ├── Polls kahalany.dev/api/dev/sync on startup   │  │
│  │  │   ├── Fetches new tickets, approval events         │  │
│  │  │   └── Caches locally, serves to Claude via files   │  │
│  │  └── NEW: Scaffold service                            │  │
│  │      └── Creates C:\KDEV\{Project} on approval        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  C:\KDEV\{ProjectName}\                               │  │
│  │  ├── CLAUDE.md ......... Project plan + portal IDs    │  │
│  │  ├── PROGRESS.md ....... Dev log (Claude writes)      │  │
│  │  ├── APP-MAP.md ........ Architecture (Claude writes) │  │
│  │  ├── .portal.json ...... Portal metadata (project ID, │  │
│  │  │                       milestone IDs, last sync)    │  │
│  │  └── src/ .............. Actual project code          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  This PC can be OFF. Portal still works for clients.        │
│  When PC comes online, it syncs latest state.               │
└─────────────────────────────────────────────────────────────┘
```

### Critical Design Principle

**The Hetzner server is fully independent.** It serves the portal, stores all data, handles all client interactions. Your PC is a development tool that *reads from* and *writes to* the server — but the server never depends on your PC. If your PC is off for a week, clients can still:
- View their project progress
- Create and comment on tickets
- See milestone status
- Download files you've uploaded

When your PC comes back online, Claude-Code-Desk-Mobile syncs the latest state and you pick up where you left off.

---

## 3. Security Model

### 3.1 Threat Model

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Client accesses another client's data | Critical | Row-level isolation — every query filters by org_id |
| Client accesses admin/dev endpoints | Critical | Role-based middleware — separate route guards per role |
| Dev API token leaked | High | HMAC-signed requests + IP allowlisting + token rotation |
| SQL injection via ticket content | High | Parameterized queries only (sql.js prepared statements) |
| XSS via ticket/comment content | High | Server-side HTML sanitization + CSP headers |
| CSRF on state-changing endpoints | Medium | SameSite cookies + custom header requirement |
| Brute-force login | Medium | Rate limiting (5 attempts/15min) + account lockout |
| Session hijacking | Medium | Short-lived JWTs (1h) + refresh token rotation |
| File upload abuse (malware, huge files) | Medium | File type allowlist, size limits, virus scanning (future) |
| Enumeration attacks (user/project IDs) | Low | UUIDs instead of sequential IDs for all client-facing entities |

### 3.2 Authentication & Authorization

#### Role Hierarchy

```
admin   → Full access to everything (existing)
staff   → Access to assigned projects, can manage tickets/milestones
client  → Access to own organization's projects ONLY
```

#### JWT Token Structure

```json
{
  "sub": "user-uuid",
  "role": "client",
  "org_id": "org-uuid",
  "iat": 1711700000,
  "exp": 1711703600
}
```

- **Access token**: 1 hour expiry
- **Refresh token**: 30 days, rotated on every use (old token invalidated)
- **Refresh tokens stored server-side** in a `refresh_tokens` table — can be revoked instantly
- **Algorithm**: HS256 with auto-generated secret (existing pattern from `config` table)

#### Route Protection

```
/api/auth/*      → Public (login, refresh, reset password)
/api/track/*     → Public (visitor tracking)
/api/portal/*    → requireAuth + requireRole('client') + enforceOrgScope
/api/admin/*     → requireAuth + requireRole('admin')
/api/dev/*       → requireDevAuth (HMAC signature, separate from JWT)
```

#### enforceOrgScope Middleware

Every portal API request automatically scopes queries to the authenticated user's `org_id`. There is no endpoint where a client can pass an arbitrary org_id or project_id that doesn't belong to them.

```javascript
// Pseudocode — every portal route gets this automatically
function enforceOrgScope(req, res, next) {
  const project = db.get('SELECT * FROM projects WHERE id = ? AND org_id = ?',
    [req.params.projectId, req.user.org_id]);
  if (!project) return res.status(404).json({ error: 'Not found' });
  req.project = project;
  next();
}
```

If a client guesses another project's UUID, they get a 404 — not a 403 (prevents confirming existence).

### 3.3 Dev API Security (Claude ↔ Server)

The `/api/dev/*` endpoints are how your local PC pushes progress updates and reads project state. These are the most sensitive endpoints because they can modify project data.

#### HMAC-Signed Requests

Instead of a static Bearer token (which if leaked grants permanent access), every request is signed:

```
Headers:
  X-Dev-Key-Id: <key-id>              # Identifies which key (for rotation)
  X-Dev-Timestamp: <unix-seconds>     # Must be within ±60s of server time
  X-Dev-Signature: <HMAC-SHA256>      # HMAC of: method + path + timestamp + body
```

```javascript
// Signature generation (on your PC)
const payload = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
const signature = crypto.createHmac('sha256', devSecret).update(payload).digest('hex');
```

```javascript
// Verification (on server)
function requireDevAuth(req, res, next) {
  const keyId = req.headers['x-dev-key-id'];
  const timestamp = parseInt(req.headers['x-dev-timestamp']);
  const signature = req.headers['x-dev-signature'];

  // Reject if timestamp is stale (replay protection)
  if (Math.abs(Date.now() / 1000 - timestamp) > 60) {
    return res.status(401).json({ error: 'Request expired' });
  }

  // Look up key
  const key = db.get('SELECT * FROM dev_keys WHERE key_id = ? AND revoked = 0', [keyId]);
  if (!key) return res.status(401).json({ error: 'Invalid key' });

  // Verify HMAC
  const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body) || '').digest('hex');
  const payload = `${req.method}\n${req.path}\n${timestamp}\n${bodyHash}`;
  const expected = crypto.createHmac('sha256', key.secret).update(payload).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  req.devKey = key;
  next();
}
```

#### Key Management

- Dev keys are generated via the admin panel: Settings → Dev API Keys
- Each key has a `key_id` (public) and `secret` (shown once on creation, never stored in plaintext — we store the key itself since HMAC needs the raw secret, but it's only in the DB)
- Keys can be revoked instantly from the admin panel
- Old keys auto-expire after 90 days (configurable)
- The secret is stored locally in `C:\KDEV\.portal\config.json` (gitignored globally)

### 3.4 Input Sanitization

All user-provided content (ticket titles, descriptions, comments) goes through:

1. **Length limits** — title: 200 chars, description: 10,000 chars, comment: 5,000 chars
2. **HTML stripping** — No raw HTML allowed. Content stored as plain text or Markdown.
3. **Markdown rendering** — Done client-side only, with a safe renderer (no raw HTML passthrough)
4. **File name sanitization** — Uploaded file names stripped of path separators, null bytes, special chars
5. **SQL** — All queries use parameterized prepared statements (already the pattern in db.js)

### 3.5 Rate Limiting

| Endpoint Group | Limit | Window | Scope |
|----------------|-------|--------|-------|
| `/api/auth/login` | 5 requests | 15 minutes | Per IP |
| `/api/auth/refresh` | 10 requests | 1 minute | Per IP |
| `/api/portal/*` (reads) | 60 requests | 1 minute | Per user |
| `/api/portal/*` (writes) | 20 requests | 1 minute | Per user |
| `/api/dev/*` | 30 requests | 1 minute | Per key |
| File uploads | 10 files | 1 hour | Per user |

### 3.6 Content Security Policy

```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],  // Chart.js CDN
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    }
  }
});
```

### 3.7 Audit Trail

Every state-changing action on the portal is logged to the `activity_log` table:

- Who did it (user_id, role, IP address)
- What they did (action type, entity type, entity ID)
- Before/after values (for status changes)
- Timestamp

Admins can review the full audit log. This is non-deletable — even admins cannot purge the audit trail.

---

## 4. Data Model

### New Tables

```sql
-- Client organizations
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,              -- UUID
  name TEXT NOT NULL,
  logo_path TEXT,                   -- Path in data/uploads/orgs/
  primary_email TEXT NOT NULL,
  notes TEXT,                       -- Internal notes (admin only)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,              -- UUID
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,        -- URL-safe name (e.g., "pcg-website-redesign")
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
    -- planning → proposed → approved → in_progress → review → completed → maintenance → archived
  progress_percent INTEGER DEFAULT 0,  -- 0-100, calculated from milestones
  tech_stack TEXT,                  -- JSON array of tech tags
  repo_url TEXT,                    -- GitHub repo URL (internal)
  live_url TEXT,                    -- Live deployment URL
  coolify_uuid TEXT,                -- Coolify app UUID (internal)
  start_date TEXT,
  target_date TEXT,
  completed_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Project members (who can see/interact with a project)
CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',  -- owner | member | viewer
  added_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, user_id)
);

-- Milestones (project phases)
CREATE TABLE milestones (
  id TEXT PRIMARY KEY,              -- UUID
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',  -- upcoming | in_progress | completed | skipped
  sort_order INTEGER NOT NULL DEFAULT 0,
  target_date TEXT,
  completed_date TEXT,
  completion_notes TEXT,            -- What was done (shown to client)
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tickets
CREATE TABLE tickets (
  id TEXT PRIMARY KEY,              -- UUID
  project_id TEXT NOT NULL REFERENCES projects(id),
  ticket_number INTEGER NOT NULL,   -- Sequential per project (PCG-1, PCG-2, etc.)
  created_by TEXT NOT NULL REFERENCES users(id),
  assigned_to TEXT REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'task',
    -- task | bug | feature_request | modification | maintenance | question
  priority TEXT NOT NULL DEFAULT 'medium',  -- low | medium | high | urgent
  status TEXT NOT NULL DEFAULT 'open',
    -- open | in_progress | review | completed | closed
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  closed_at TEXT
);

-- Ticket comments
CREATE TABLE ticket_comments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0,  -- 1 = admin/staff only, hidden from client
  created_at TEXT DEFAULT (datetime('now'))
);

-- Ticket attachments
CREATE TABLE ticket_attachments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,           -- Original filename (sanitized)
  stored_name TEXT NOT NULL,        -- UUID-based name on disk
  mimetype TEXT NOT NULL,
  size INTEGER NOT NULL,            -- Bytes
  uploaded_at TEXT DEFAULT (datetime('now'))
);

-- Activity log (immutable audit trail)
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
    -- project_created, project_approved, milestone_completed, ticket_created,
    -- ticket_status_changed, comment_added, file_uploaded, member_added, etc.
  entity_type TEXT,                 -- project | milestone | ticket | comment
  entity_id TEXT,
  details TEXT,                     -- JSON: { old_status, new_status, notes, ... }
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Dev API keys (for Claude / local machine)
CREATE TABLE dev_keys (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL UNIQUE,      -- Public identifier
  secret TEXT NOT NULL,             -- HMAC secret (stored raw — needed for verification)
  label TEXT,                       -- "Ohav's PC", "CI Server", etc.
  revoked INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT
);

-- Refresh tokens (for token rotation & revocation)
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash (never store raw)
  device_info TEXT,                 -- "Chrome on Windows", etc.
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Project plans (the approved spec — what gets scaffolded into CLAUDE.md)
CREATE TABLE project_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) UNIQUE,
  content TEXT NOT NULL,            -- Markdown: full project specification
  version INTEGER NOT NULL DEFAULT 1,
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id),  -- Client user who approved
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### Modified Existing Tables

```sql
-- Extend users table
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';
  -- admin | staff | client
ALTER TABLE users ADD COLUMN org_id TEXT REFERENCES organizations(id);
  -- NULL for admin/staff, set for client users
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;
  -- Account lockout after 5 failed attempts (15 min lock)
```

### ID Strategy

All client-facing IDs are **UUIDv4** strings. This prevents:
- Sequential enumeration ("let me try project 2, 3, 4...")
- Leaking information about system size
- Collisions if we ever need to merge data

Ticket numbers are sequential per project for human readability (PCG-1, PCG-2), but API access always uses the UUID.

---

## 5. The Project Lifecycle

### State Machine

```
 ┌──────────┐    Admin creates     ┌──────────┐
 │          │    project + plan     │          │
 │  (none)  │───────────────────── │ planning │
 │          │                      │          │
 └──────────┘                      └────┬─────┘
                                        │
                              Admin sends plan to client
                                        │
                                   ┌────▼─────┐
                                   │          │
                                   │ proposed │  Client sees plan, can comment
                                   │          │
                                   └────┬─────┘
                                        │
                              Client clicks "Approve"
                                        │
                                   ┌────▼─────┐
                                   │          │  → Triggers local scaffolding
                                   │ approved │  → Folder created in C:\KDEV
                                   │          │  → Claude gets context
                                   └────┬─────┘
                                        │
                              Dev work begins
                                        │
                                ┌───────▼────────┐
                                │                │  Milestones tracked
                                │  in_progress   │  Tickets flow
                                │                │  Claude reports progress
                                └───────┬────────┘
                                        │
                              All milestones complete
                                        │
                                   ┌────▼─────┐
                                   │          │  Client reviews final delivery
                                   │  review  │  Signs off
                                   │          │
                                   └────┬─────┘
                                        │
                              Client accepts
                                        │
                                ┌───────▼────────┐
                                │                │  Project live
                                │   completed    │  Maintenance phase available
                                │                │
                                └───────┬────────┘
                                        │
                              Client requests ongoing support
                                        │
                                ┌───────▼────────┐
                                │                │  Ongoing tickets
                                │  maintenance   │  Monthly check-ins
                                │                │  Recurring tasks
                                └───────┬────────┘
                                        │
                              Contract ends / client leaves
                                        │
                                   ┌────▼─────┐
                                   │          │  Read-only archive
                                   │ archived │  Data retained
                                   │          │
                                   └──────────┘
```

### The Approval Moment — What Happens

When a client clicks "Approve Project" on the portal:

1. **On the server (immediate)**:
   - `projects.status` → `"approved"`
   - `projects.start_date` → now
   - `project_plans.approved_at` → now
   - `project_plans.approved_by` → client user ID
   - Activity log entry: `"project_approved"`
   - First milestone status → `"in_progress"`

2. **On your PC (next sync)**:
   - Claude-Code-Desk-Mobile portal sync service detects the approval
   - Scaffolding runs automatically:

```
C:\KDEV\{ProjectName}\
├── CLAUDE.md           ← Generated from project plan + portal metadata
├── PROGRESS.md         ← Empty template
├── APP-MAP.md          ← Initial architecture from plan
├── .portal.json        ← Machine-readable portal metadata
├── .gitignore          ← Standard (node_modules/, data/, .portal.json)
└── (empty src structure based on tech stack)
```

3. **CLAUDE.md contents** (auto-generated):

```markdown
# {Project Name} — Claude Code Instructions

## Project Context
- **Client**: {Org Name}
- **Portal Project ID**: {uuid}
- **Status**: In Progress
- **Started**: 2026-03-29

## Project Plan
{Full approved plan content pasted here — this is the static background context}

## Milestones
| # | Phase | Status | Target |
|---|-------|--------|--------|
| 1 | Database & API | In Progress | 2026-04-05 |
| 2 | Frontend Build | Upcoming | 2026-04-15 |
| 3 | Auth & Security | Upcoming | 2026-04-20 |
| 4 | Deploy & Polish | Upcoming | 2026-04-25 |

## Portal Sync
Progress reporting is handled via the portal sync file.
When you complete a milestone, update .portal.json:
- Set the milestone status to "completed"
- Add completion_notes describing what was built
- The sync service will push this to the portal automatically

## On Every New Conversation
- Read PROGRESS.md and APP-MAP.md before starting work.
- Check .portal.json for any new tickets (synced field: pending_tickets).
- If there are pending tickets, acknowledge them before starting new work.
```

4. **.portal.json contents**:

```json
{
  "project_id": "uuid-here",
  "org_id": "uuid-here",
  "project_name": "PCG Website Redesign",
  "last_synced": "2026-03-29T14:30:00Z",
  "milestones": [
    {
      "id": "ms-uuid-1",
      "title": "Database & API",
      "status": "in_progress",
      "sort_order": 1
    }
  ],
  "pending_tickets": [],
  "sync_status": "ok"
}
```

---

## 6. Claude Code Integration

### 6.1 How Claude Gets Context (Without Eating Tokens)

**The problem**: Loading the entire portal state (all tickets, all comments, full history) into every Claude conversation would burn through tokens fast.

**The solution**: A layered context strategy.

```
Layer 1: CLAUDE.md (always loaded — project plan, milestones)
  └── This is static. Written once on scaffolding, rarely changes.
  └── ~500-2000 tokens depending on project size. Acceptable.

Layer 2: .portal.json (small JSON — only IDs, statuses, pending items)
  └── Updated by sync service. Claude reads this on conversation start.
  └── ~200-500 tokens. Just metadata.

Layer 3: On-demand ticket detail (only when Claude needs it)
  └── Claude runs: cat .portal/tickets/TICKET-UUID.md
  └── Sync service writes individual ticket files only for PENDING tickets.
  └── Once a ticket is handled, the file is deleted locally.
  └── ~100-300 tokens per ticket. Only loaded when relevant.
```

**What gets synced locally vs. what stays on the server**:

| Data | Synced Locally? | Where It Lives |
|------|----------------|----------------|
| Approved project plan | Yes — in CLAUDE.md | Static, written once |
| Milestone list + statuses | Yes — in .portal.json | Updated on sync |
| Pending tickets (new/unread) | Yes — in .portal/tickets/ | Individual .md files, deleted after handling |
| Completed tickets | No | Server only |
| Full ticket history | No | Server only |
| Comments thread | No (unless ticket is pending) | Server only |
| Activity log | No | Server only |
| File attachments | No | Server only |

### 6.2 The Sync Service (runs in Claude-Code-Desk-Mobile)

A background service in the Claude-Code-Desk-Mobile server that keeps local project folders in sync with the portal.

**When it runs**:
- On Claude-Code-Desk-Mobile startup (catches up on everything missed while PC was off)
- Every 5 minutes while running (lightweight poll)
- On-demand when you open a project tab (immediate sync for that project)

**What it does on each sync**:

```
For each project in C:\KDEV that has a .portal.json:

1. GET /api/dev/sync?project_id={id}&since={last_synced}
   Server returns:
   {
     "milestones": [{ id, status, ... }],      // Current milestone statuses
     "new_tickets": [{ id, title, type, priority, description, comments }],
     "updated_tickets": [{ id, status }],       // Status changes since last sync
     "project_status": "in_progress",
     "progress_percent": 45
   }

2. Update .portal.json with new milestone statuses

3. Write new ticket files to .portal/tickets/{ticket-number}.md:
   ---
   Ticket: PCG-5
   Type: modification
   Priority: high
   Status: open
   From: John (PCG)
   Date: 2026-03-29
   ---
   Can we change the header font to Montserrat?
   The current one feels too corporate.

4. Remove .portal/tickets/ files for tickets that are now closed

5. Update .portal.json last_synced timestamp
```

**What it pushes to the server**:

```
For each project in C:\KDEV that has a .portal.json:

1. Check if .portal.json has any local changes (milestone status updates)
2. If yes, POST /api/dev/progress with the changes
3. Server updates milestone statuses, recalculates progress_percent
4. Client sees the update on their dashboard
```

### 6.3 How Claude Reports Progress

When Claude finishes a milestone during development:

**Step 1**: Claude updates `.portal.json` locally:

```json
{
  "milestones": [
    {
      "id": "ms-uuid-1",
      "title": "Database & API",
      "status": "completed",
      "completion_notes": "SQLite schema created with 6 tables. Express API with 12 endpoints. JWT auth system with role-based access."
    }
  ]
}
```

**Step 2**: The sync service detects the change and pushes to the server:

```
POST /api/dev/progress
{
  "project_id": "uuid",
  "updates": [
    {
      "milestone_id": "ms-uuid-1",
      "status": "completed",
      "completion_notes": "SQLite schema created with..."
    },
    {
      "milestone_id": "ms-uuid-2",
      "status": "in_progress"
    }
  ]
}
```

**Step 3**: Server updates the DB. Client refreshes their dashboard and sees Phase 1 complete, Phase 2 started.

**Why file-based, not API-based**: Claude Code doesn't need to know about HTTP APIs, HMAC signing, or auth tokens. It just edits a JSON file — something it does naturally in every project. The sync service handles all the complexity.

### 6.4 How Claude Handles Tickets

When you open a project in Claude-Code-Desk-Mobile:

1. Sync service runs immediately for that project
2. Any new tickets are written to `.portal/tickets/`
3. Claude reads `.portal.json` and sees `"pending_tickets": ["PCG-5", "PCG-7"]`
4. When you start a conversation, Claude checks for pending tickets:

```
Claude reads .portal.json → sees 2 pending tickets
Claude: "I see 2 new tickets from the client:
  - PCG-5 (high priority): Change header font to Montserrat
  - PCG-7 (medium): Add phone number to contact page
  Should I handle these first?"
```

5. When Claude resolves a ticket, it updates `.portal.json`:

```json
{
  "resolved_tickets": [
    {
      "ticket_id": "uuid",
      "ticket_number": "PCG-5",
      "resolution_notes": "Changed header font to Montserrat across all pages. Updated styles.css font-face import and typography variables."
    }
  ]
}
```

6. Sync service pushes this to the server:
   - Ticket status → `"completed"`
   - Resolution comment added to ticket thread (visible to client)
   - Activity log entry created

### 6.5 Token Budget Breakdown

For a typical project with 4 milestones and 2 pending tickets:

```
CLAUDE.md (project plan)          ~1,500 tokens  ← loaded every conversation
.portal.json (metadata)             ~300 tokens  ← loaded every conversation
Pending ticket #1 (if read)         ~200 tokens  ← loaded on demand
Pending ticket #2 (if read)         ~150 tokens  ← loaded on demand
─────────────────────────────────────────────────
Total per conversation start:     ~1,800 tokens  (without tickets)
Total if reading both tickets:    ~2,150 tokens

For comparison:
  Claude Opus context window:     200,000 tokens
  Typical coding conversation:    30,000-80,000 tokens
  Portal overhead:                ~1-3% of a typical conversation
```

This is negligible. The key is that we **never** load:
- Full ticket history (stays on server)
- Old/closed tickets (deleted locally after sync)
- Activity logs (only on server)
- Other projects' data (scoped to the open project)

---

## 7. Token Optimization Strategy

### Rules

1. **CLAUDE.md is write-once** — The approved plan goes in at scaffolding time and rarely changes. It's the "background knowledge" that Claude always has.

2. **Pending tickets only** — Only unresolved tickets sync to the local filesystem. The moment a ticket is closed, its local file is deleted. Claude never sees old tickets.

3. **Summaries over full threads** — When syncing a ticket with many comments, the sync service writes a **summary** to the local file, not the full thread:
   ```markdown
   ## PCG-5: Change header font
   **Latest from client** (Mar 29): Can we change to Montserrat? Current feels corporate.
   **Thread summary**: 3 comments. Client originally asked about Poppins, then changed to Montserrat.
   ```

4. **On-demand deep context** — If Claude needs the full comment thread for a complex ticket, you can tell it: "fetch the full thread for PCG-5" and it reads from `.portal/tickets/PCG-5-full.md` (sync service fetches it on demand, writes it, Claude reads it, then it's deleted after the conversation).

5. **No project list in context** — Claude only sees the project it's currently working in. It doesn't load a list of all projects, all clients, or anything outside the current `C:\KDEV\{ProjectName}` folder.

6. **Milestone statuses are IDs, not prose** — `.portal.json` stores compact metadata, not human-readable paragraphs. Claude reads it as structured data.

---

## 8. Offline PC Handling

### The Core Guarantee

**Clients are never affected by your PC being on or off.** The portal runs on Hetzner 24/7.

### What Works When PC Is Off

| Feature | Works? | How |
|---------|--------|-----|
| Client logs into portal | Yes | Auth is on Hetzner |
| Client views project progress | Yes | Data is in Hetzner SQLite |
| Client creates a ticket | Yes | Stored in Hetzner DB |
| Client comments on a ticket | Yes | Stored in Hetzner DB |
| Client uploads a file | Yes | Stored on Hetzner |
| Client sees milestone updates | Yes | Progress was pushed before PC went off |
| Client approves a project | Yes | Status change stored in DB |

### What Happens When PC Comes Back Online

```
1. Claude-Code-Desk-Mobile starts up
2. Portal sync service initializes
3. For each project with .portal.json in C:\KDEV:
   a. Calls GET /api/dev/sync?project_id={id}&since={last_synced}
   b. Downloads all events since last sync:
      - New tickets created while you were offline
      - New comments on existing tickets
      - Status changes
      - New project approvals (triggers scaffolding!)
   c. Updates local .portal.json and .portal/tickets/ files
4. You see notifications in Claude-Code-Desk-Mobile:
   "3 new tickets across 2 projects while you were offline"
5. When you open a project tab, Claude has full context immediately
```

### Edge Case: Client Approves While PC Is Off

```
Client approves at 2 AM (PC is off)
  → Server sets project.status = "approved" ✓
  → Server recalculates progress ✓
  → Client sees "Project Approved — Development Starting Soon" ✓

Next morning, you turn on PC:
  → Sync detects new approval
  → Scaffolding runs: creates C:\KDEV\{Project}\
  → You get a desktop notification
  → Project appears in Claude-Code-Desk-Mobile sidebar
  → You open it, Claude reads CLAUDE.md, ready to go
```

### Edge Case: You Complete Work, Push Progress, Then Turn Off PC

```
You finish Phase 2 at 11 PM
  → Claude updates .portal.json (milestone 2 → completed)
  → Sync service pushes to server immediately
  → Server updates DB, client can see Phase 2 complete ✓
  → You close laptop

Next morning, client creates ticket about Phase 2 work
  → Ticket stored on Hetzner ✓
  → Client sees "Ticket PCG-8 created" ✓
  → When you turn PC on, sync pulls the ticket ✓
```

### What DOESN'T Work When PC Is Off

- New code being written (obviously — Claude runs on your PC)
- Progress updates from active development (nothing to update)
- Scaffold creation for newly approved projects (queued until PC is on)

**This is expected and fine.** Clients understand that development happens during working hours. The portal gives them visibility and a way to communicate — it doesn't promise 24/7 real-time development.

---

## 9. Client Portal (What Clients See)

### URL: `https://kahalany.dev/portal`

### 9.1 Login Page

- Email + password (same auth system as admin, role = client)
- "Forgot Password" → reset via server logs (same as admin, for now)
- Future: email-based password reset
- First login forces password change (same `must_change_password` pattern)
- After login, JWT stored in localStorage, auto-refresh on expiry

### 9.2 Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  { kahalany.dev }                          John ▾  Logout   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Welcome back, John                                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  PCG Website Redesign              Status: Active    │    │
│  │  ████████████████░░░░░░░░░░░░░░░░░░  45%            │    │
│  │                                                     │    │
│  │  Current Phase: Frontend Build                      │    │
│  │  Next Milestone: Auth & Security (Apr 20)           │    │
│  │                                                     │    │
│  │  Open Tickets: 2    Awaiting Response: 1            │    │
│  │                                                     │    │
│  │  [View Project]  [Create Ticket]                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Recent Activity                                            │
│  ├─ Today — Phase 1: Database & API completed               │
│  ├─ Today — Ticket PCG-3 resolved                           │
│  ├─ Yesterday — New comment on PCG-5                        │
│  └─ Mar 27 — Project approved                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Project View

- Progress bar showing overall completion
- Milestone timeline (vertical list, color-coded by status)
  - Green checkmark: completed (with date and notes)
  - Blue spinner: in progress
  - Gray circle: upcoming
- Project description and tech stack tags
- Quick actions: Create Ticket, View Tickets

### 9.4 Plan View (Before Approval)

When status is `proposed`:
- Full project plan displayed in rendered Markdown
- Client can comment (creates a ticket of type `question`)
- Big "Approve Project" button at the bottom
- Approval requires a confirmation dialog: "This will begin development. Are you sure?"

### 9.5 Tickets

**Ticket List**:
- Filter by: status (open/in_progress/completed/all), type, priority
- Sort by: newest, priority, last updated
- Each row: ticket number, title, type badge, priority badge, status, last update time

**Create Ticket**:
- Title (required)
- Type: Change Request / Bug Report / Question / Other
- Priority: Low / Medium / High (no "urgent" for clients — admin can escalate)
- Description (Markdown-supported textarea)
- Attach files (drag & drop, max 10MB per file, max 5 files)

**Ticket Detail**:
- Full description
- Attachments (downloadable)
- Comment thread (chronological)
  - Client sees only public comments (is_internal = 0)
  - Each comment shows author name, role badge, timestamp
- Add comment form at bottom
- Status badge (client can see status but not change it directly)

### 9.6 Client Cannot

- See other clients' projects or data (enforced server-side)
- See internal comments
- Change ticket status (only admin/staff can)
- Change milestone status
- Access admin panel, analytics, or security pages
- See dev API keys, server configuration, or infrastructure details
- Delete anything (tickets, comments, files — only admin can)

---

## 10. Admin Panel Extensions (What You See)

### New Sidebar Items

```
Existing:
  📊 Dashboard
  🛡️ Security
  📈 Analytics
  ⚙️ Settings

New:
  📋 Projects        ← All projects across all clients
  👥 Clients         ← Organization management
```

### 10.1 Projects Page

**List View**:
- All projects with: client name, status badge, progress bar, open tickets count, last activity
- Filter by: status, client
- Quick actions: View, Edit, Archive

**Project Detail** (admin view):
- Everything the client sees PLUS:
  - Internal notes field
  - Edit milestones (add, remove, reorder, change dates, mark complete manually)
  - Edit project details (status, dates, tech stack, repo URL, Coolify UUID)
  - Member management (add/remove staff, add/remove client users)
  - Plan editor (Markdown editor for the project plan)
  - "Send Plan to Client" button (changes status to `proposed`)
  - Ticket management with internal comments visible

### 10.2 Clients Page

- List all organizations
- Add new organization (name, primary email, notes)
- For each org: list their projects, their portal users
- Add client user: generates random password, shown once (same pattern as admin creation)
- Disable/enable client user (without deleting)

### 10.3 Settings Extensions

- **Dev API Keys**: Generate, list, revoke keys for the dev API
- **Portal Settings**: Default ticket types, priority levels, file upload limits

---

## 11. API Specification

### 11.1 Portal API (`/api/portal/*`) — Client-Facing

All endpoints require `requireAuth` + `requireRole('client')` + `enforceOrgScope`.

```
GET    /api/portal/dashboard
  → { projects: [...], recent_activity: [...] }

GET    /api/portal/projects/:projectId
  → { project, milestones, open_ticket_count, recent_activity }

GET    /api/portal/projects/:projectId/plan
  → { plan_content, status, approved_at }

POST   /api/portal/projects/:projectId/approve
  → Approves the project plan. Requires status = "proposed".
  → Returns { success: true, message: "Project approved" }

GET    /api/portal/projects/:projectId/tickets
  → { tickets: [...] }  (filtered by org scope, no internal comments)
  Query: ?status=open&type=bug&sort=newest&page=1&limit=20

GET    /api/portal/projects/:projectId/tickets/:ticketId
  → { ticket, comments: [...] }  (comments filtered: is_internal = 0)

POST   /api/portal/projects/:projectId/tickets
  → Create ticket. Body: { title, type, priority, description }
  → Returns { ticket }

POST   /api/portal/tickets/:ticketId/comments
  → Add comment. Body: { body }
  → Returns { comment }

POST   /api/portal/tickets/:ticketId/attachments
  → Upload file. Multipart form data.
  → Returns { attachment: { id, filename, size } }

GET    /api/portal/tickets/:ticketId/attachments/:attachmentId
  → Download file. Streams the file with proper Content-Type.

GET    /api/portal/projects/:projectId/activity
  → { activities: [...] }  (filtered: no internal actions)
  Query: ?page=1&limit=50
```

### 11.2 Admin Project API (`/api/admin/*`) — Extended

All endpoints require `requireAuth` + `requireRole('admin')`.

```
GET    /api/admin/projects
  → All projects across all orgs

GET    /api/admin/projects/:projectId
  → Full project detail including internal notes

POST   /api/admin/projects
  → Create project. Body: { org_id, name, description, tech_stack }

PATCH  /api/admin/projects/:projectId
  → Update project fields

POST   /api/admin/projects/:projectId/plan
  → Create/update project plan. Body: { content }

POST   /api/admin/projects/:projectId/propose
  → Send plan to client (status → "proposed")

POST   /api/admin/projects/:projectId/milestones
  → Add milestone. Body: { title, description, target_date, sort_order }

PATCH  /api/admin/milestones/:milestoneId
  → Update milestone (status, dates, notes)

DELETE /api/admin/milestones/:milestoneId
  → Remove milestone

PATCH  /api/admin/tickets/:ticketId
  → Update ticket (assign, change status/priority)

POST   /api/admin/tickets/:ticketId/comments
  → Add comment. Body: { body, is_internal }  (can be internal)

GET    /api/admin/clients
  → List all organizations

POST   /api/admin/clients
  → Create organization. Body: { name, primary_email }

PATCH  /api/admin/clients/:orgId
  → Update organization

POST   /api/admin/clients/:orgId/users
  → Create client user for org. Returns temp password.

DELETE /api/admin/clients/:orgId/users/:userId
  → Remove client user

GET    /api/admin/dev-keys
  → List dev API keys

POST   /api/admin/dev-keys
  → Generate new dev key. Returns { key_id, secret } (secret shown once)

DELETE /api/admin/dev-keys/:keyId
  → Revoke dev key
```

### 11.3 Dev API (`/api/dev/*`) — Local Machine

All endpoints require `requireDevAuth` (HMAC signature verification).

```
GET    /api/dev/sync
  → Sync endpoint. Returns everything changed since last sync.
  Query: ?project_id={uuid}&since={ISO-timestamp}
  → {
      project_status, progress_percent,
      milestones: [{ id, status, ... }],
      new_tickets: [{ id, number, title, type, priority, description,
                      latest_comment: { body, author, date } }],
      updated_tickets: [{ id, status }],
      closed_tickets: [{ id }]
    }

GET    /api/dev/projects/pending
  → Returns newly approved projects that haven't been scaffolded yet.
  → [{ project_id, name, slug, plan_content, milestones, tech_stack }]

POST   /api/dev/projects/:projectId/scaffolded
  → Marks a project as scaffolded (so it doesn't show up in /pending again)

POST   /api/dev/progress
  → Push milestone updates.
  Body: {
    project_id,
    updates: [{ milestone_id, status, completion_notes }]
  }

POST   /api/dev/tickets/:ticketId/resolve
  → Mark ticket as completed with resolution notes.
  Body: { resolution_notes }
  → Creates a public comment with the resolution, sets status to "completed"

GET    /api/dev/tickets/:ticketId/full
  → Returns complete ticket with ALL comments (for deep context when needed)
  → Only used on-demand, not during regular sync

POST   /api/dev/activity
  → Log a development activity.
  Body: { project_id, action, details }
  → Used for: code_pushed, deploy_triggered, repo_created, etc.
```

---

## 12. Notification System

### Phase 1: In-App Only

**Client sees**:
- Unread badge on "Tickets" nav item
- "New" indicator on tickets with unread comments
- Activity feed with timestamps

**Admin sees**:
- Notification badge on "Projects" nav item
- "New ticket" indicators
- Activity feed across all projects

### Phase 2: Email Notifications (Future)

Using a transactional email service (Resend, SendGrid, or Cloudflare Workers Email):

**Client receives email for**:
- Milestone completed ("Phase 2 of your project is done!")
- Ticket status changed ("Your request has been completed")
- Comment added to their ticket

**Admin receives email for**:
- New ticket created by client
- Client approved project
- Client commented on a ticket

**Configuration**:
- Per-user toggle: email notifications on/off
- Per-event-type toggle (don't spam)
- Digest option: daily summary instead of per-event

---

## 13. File Upload & Storage

### Storage Location

```
data/
├── analytics.db          ← Existing SQLite database
└── uploads/
    ├── orgs/
    │   └── {org-uuid}/
    │       └── logo.png
    └── tickets/
        └── {ticket-uuid}/
            ├── {uuid}-screenshot.png
            ├── {uuid}-design-mockup.pdf
            └── {uuid}-requirements.docx
```

### Constraints

| Constraint | Value |
|------------|-------|
| Max file size | 10 MB per file |
| Max files per ticket | 10 |
| Max total storage per org | 500 MB (soft limit, warn admin) |
| Allowed file types | Images (png, jpg, gif, webp, svg), Documents (pdf, doc, docx, xls, xlsx, txt, csv), Archives (zip) |
| Blocked file types | Executables (.exe, .bat, .sh, .cmd), Scripts (.js, .py, .php), System files (.dll, .sys) |

### Security

- Files are stored with UUID-based names (not original filenames) to prevent path traversal
- Original filename stored in DB for display
- Files served through an authenticated endpoint — not directly accessible via URL
- Content-Type set from DB (not from file extension) to prevent MIME sniffing
- `Content-Disposition: attachment` on all downloads (prevents inline execution)
- File size verified server-side (don't trust Content-Length header)

### Docker Volume

The `data/` directory is already mounted as a persistent Docker volume in Coolify. File uploads persist across container restarts.

---

## 14. Implementation Phases

### Phase 1 — Foundation (Week 1-2)

**Goal**: Clients can log in, see their project, and create tickets.

**Backend**:
- [ ] Extend `users` table with `role`, `org_id`, `display_name`, lockout fields
- [ ] Create all new tables (organizations, projects, milestones, tickets, etc.)
- [ ] Implement `requireRole()` middleware
- [ ] Implement `enforceOrgScope()` middleware
- [ ] Build portal API routes (dashboard, project view, tickets CRUD)
- [ ] Build admin project/client management API routes
- [ ] Add rate limiting per endpoint group
- [ ] Add input sanitization layer
- [ ] Add activity logging to all state-changing endpoints

**Frontend (Portal SPA)**:
- [ ] Create `portal/` directory (index.html, styles.css, app.js)
- [ ] Login page (reuse existing pattern)
- [ ] Dashboard page
- [ ] Project view with milestone timeline
- [ ] Ticket list with filters
- [ ] Ticket detail with comments
- [ ] Create ticket form

**Frontend (Admin Panel Extensions)**:
- [ ] Add Projects page to admin sidebar
- [ ] Add Clients page to admin sidebar
- [ ] Project detail page with milestone management
- [ ] Client management (create org, add client user)

### Phase 2 — Dev API & Claude Integration (Week 3)

**Goal**: Claude can read project context and report progress.

**Backend**:
- [ ] Implement HMAC-signed auth for dev API
- [ ] Build `/api/dev/sync` endpoint
- [ ] Build `/api/dev/progress` endpoint
- [ ] Build `/api/dev/projects/pending` endpoint
- [ ] Build `/api/dev/tickets/:id/resolve` endpoint
- [ ] Add dev key management to admin settings

**Claude-Code-Desk-Mobile Integration**:
- [ ] Build portal sync service (background polling)
- [ ] Build scaffolding service (folder creation on approval)
- [ ] CLAUDE.md template generator
- [ ] .portal.json read/write logic
- [ ] .portal/tickets/ file management
- [ ] Startup sync (catch up on missed events)
- [ ] Desktop notification for new tickets/approvals

### Phase 3 — Project Plans & Approval Flow (Week 4)

**Goal**: Full lifecycle from planning to approval to development.

**Backend**:
- [ ] Build plan CRUD endpoints
- [ ] Build propose/approve workflow
- [ ] Build plan versioning

**Frontend (Admin)**:
- [ ] Markdown plan editor
- [ ] "Send to Client" button
- [ ] Plan version history

**Frontend (Portal)**:
- [ ] Plan view page
- [ ] "Approve Project" button with confirmation
- [ ] Plan comment ability (creates ticket)

### Phase 4 — File Uploads & Polish (Week 5)

**Goal**: File attachments, email notifications, UX polish.

- [ ] File upload endpoint with validation
- [ ] File download endpoint with auth
- [ ] Attachment UI in ticket detail
- [ ] Drag-and-drop upload
- [ ] Email notification system (optional — depends on email service choice)
- [ ] Mobile responsive polish for portal
- [ ] Loading states, error handling, empty states
- [ ] Comprehensive testing

### Phase 5 — PCG Pilot & Iteration (Week 6+)

**Goal**: Real-world testing with PCG as the first client.

- [ ] Create PCG organization
- [ ] Create PCG project with real milestones
- [ ] Invite PCG contact as client user
- [ ] Migrate any existing tickets/requests into the system
- [ ] Collect feedback, iterate
- [ ] Fix issues discovered during pilot

---

## 15. PCG Pilot Plan

### Setup

1. **Organization**: "Passaic Clifton Gemach" (PCG)
2. **Project**: Whatever their current active project is
3. **Client User**: Their primary contact person
4. **Milestones**: Map to actual project phases already in progress

### Success Criteria

- Client can log in and see accurate project status
- Client can create a ticket and get a response within 24 hours
- Claude can read PCG tickets and act on them
- Progress updates pushed from Claude appear on client dashboard
- No security issues during testing
- Client feedback is positive ("this is useful, not just extra steps")

### Feedback Collection

After 2 weeks of pilot:
- What's confusing?
- What's missing?
- What do they never use?
- Would they recommend this to another client?

---

## 16. Future Enhancements

These are NOT part of the initial build. Listed for future reference.

### Near-Term (After Pilot)
- [ ] Email-based password reset (needs email sending service)
- [ ] Email notifications for ticket updates and milestones
- [ ] Real-time updates via WebSocket or Server-Sent Events (instead of polling)
- [ ] Recurring maintenance tickets (e.g., "Monthly WordPress updates")
- [ ] Time tracking per ticket (optional, for billing)

### Medium-Term
- [ ] MCP Server for Claude Code (native tool integration instead of file-based sync)
- [ ] Webhook from server to local PC (instead of polling for approvals)
- [ ] Client satisfaction survey after ticket closure
- [ ] Project templates (common tech stacks pre-configured)
- [ ] Bulk ticket operations in admin

### Long-Term
- [ ] Stripe integration for invoicing / payment tracking
- [ ] Knowledge base / FAQ per project
- [ ] Client self-service portal customization (branding per org)
- [ ] Multi-language support
- [ ] API access for clients (programmatic ticket creation)
- [ ] SLA tracking (response time guarantees)

---

## Technical Notes

### Why SQLite (Not MySQL/Postgres)?

The kahalany.dev site already uses SQLite via sql.js. Adding the portal to the same database keeps things simple:
- One database file, one backup
- No additional infrastructure
- sql.js handles concurrent reads fine
- Write volume is low (tickets, not high-frequency events)
- If we ever need to scale, migrating to PostgreSQL is straightforward — the queries are standard SQL

### Why Not a Separate Service?

The portal is part of the kahalany.dev Express server, not a separate microservice. This is intentional:
- One deployment, one container, one domain
- Shared auth system (one users table, one JWT secret)
- No inter-service communication complexity
- The traffic volume doesn't justify separation
- If it ever needs to split, the API routes are cleanly namespaced and can be extracted

### File-Based Sync vs. Direct API for Claude

We chose file-based sync (.portal.json, .portal/tickets/) over having Claude call APIs directly because:
1. **Zero token overhead** — Claude reads files naturally as part of CLAUDE.md, no tool calls needed
2. **No auth complexity** — Claude doesn't need to know about HMAC signing
3. **Works offline** — Synced data is available even if kahalany.dev is temporarily unreachable
4. **Familiar pattern** — Claude already reads CLAUDE.md, PROGRESS.md, APP-MAP.md in every project
5. **Debuggable** — You can inspect .portal.json manually to see exactly what Claude sees
