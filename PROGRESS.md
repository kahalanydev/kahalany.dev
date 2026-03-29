# Kahalany.Dev Site — Progress Log

> Portfolio/showcase site for Kahalany.Dev custom software practice.
> Live at: https://kahalany.dev
> Repo: https://github.com/kahalanydev/kahalany.dev

---

## 2026-03-25 — Initial Build & Launch

### Context
Reviewed the entire C:\KDEV project directory (~12 projects) to assess readiness for offering custom software development services. Conclusion: ready — the portfolio spans full-stack web, mobile, desktop, AI/ML, WordPress, and infrastructure. Built and deployed a portfolio site to showcase the work.

### Phase 1: Portfolio Assessment
- Scanned all 12+ project folders in C:\KDEV
- Read PROGRESS.md, CLAUDE.md, and APP-MAP.md files across all projects
- Verified 4 live sites: nodeai.kahalany.dev, predictable.kahalany.dev, davenen.kahalany.dev, torahtracker.app
- Confirmed kahalany.dev root domain was returning 503 (available for deployment)

### Phase 2: Site Build
- Created `Kahalany.Dev Site/` directory with vanilla HTML/CSS/JS (no framework, no build step)
- **index.html** — single-page site with 5 sections: Hero, Portfolio (8 projects), Capabilities (6 categories), Process (4 steps), Contact
- **styles.css** (~1400 lines) — dark theme, CSS custom properties, responsive breakpoints at 1024/768/480px
- **script.js** — scroll animations (IntersectionObserver), animated counters, rotating hero text, project filtering, hamburger menu
- **favicon.svg** — branded "K" icon with gradient

#### Hero Section
- "We build software that ships" with rotating words (ships/scales/works/lasts)
- Green pulse "Available for new projects" badge
- Animated stat counters: 12+ Production Apps, 6 Tech Stacks, 5 Live Platforms

#### Portfolio Section
- Filter bar: All / Web Apps / Mobile / AI·ML / WordPress
- 8 project cards with full descriptions, tech tags, feature tags, and status badges
- "View Live" links for 4 deployed projects

#### CSS Device Mockups
Built unique CSS-only visual representations for each project (no screenshots needed):
- **NodeAI**: Browser frame — sidebar, stat cards, map with glowing pins, data table
- **Predictable**: Browser frame — dark theme, SVG stock chart with gradient fill, verdict score circle, score cards
- **OLAMI**: Browser frame — purple sidebar, stat counters (48/12/156), check-in grid with green checkmarks
- **Torah Tracker**: **Phone frame** — notch, SVG progress ring at 75%, flame streak bar, session list with colored dots, bottom nav
- **ShipHero AI**: Browser frame — red sidebar, chat bubbles (user/AI), tool call indicator, chat input
- **Davenen**: Browser frame — indigo hero with CTA, partner cards with avatars and "Day 18/40" / "Day 32/40" counters
- **Gemach**: Browser frame — "$12,450" balance hero, amber metric cards, SVG balance line chart
- **Claude Code UI**: Browser frame — magenta file tree sidebar, tab bar, code block, git diff (red deletions / green additions)

All mockups use the `m-` CSS namespace prefix and are built from pure CSS shapes/gradients.

#### Other Sections
- **Capabilities**: 6 cards (Full-Stack, Mobile, AI/ML, WordPress, DevOps, Desktop) in responsive grid
- **Process**: 4-step vertical timeline (Understand → Architect → Build → Deploy & Support)
- **Contact**: code block visual (`new-project.ts` with syntax highlighting), email link

### Phase 3: Email Setup
- User configured `hello@kahalany.dev` via Cloudflare Email Routing
- Forwards to kahalanydev@gmail.com
- MX records configured and locked

### Phase 4: Deployment
- Initialized git repo in `Kahalany.Dev Site/`
- Set git identity: Kahalany Dev / kahalanydev@gmail.com
- Created GitHub repo: https://github.com/kahalanydev/kahalany.dev (public)
- Initial commit + push with all 6 files
- Updated Dockerfile and nginx.conf from port 80 → 8080 (Coolify standard)
- Created Coolify app via API:
  - UUID: `zcco40skss0o8wwocs40k4gs`
  - Build pack: Dockerfile
  - Domain: https://kahalany.dev
  - Auto-deploy: on push to master
- Triggered deployment via Coolify API — completed successfully
- Verified 200 response from server
- DNS already pointed (A record: kahalany.dev → 178.156.245.71, DNS only / grey cloud)
- SSL via Let's Encrypt + Traefik

### Files Created
| File | Purpose |
|------|---------|
| `index.html` | Single-page site shell (726 lines) |
| `styles.css` | All styles including CSS mockups (1445 lines) |
| `script.js` | Interactions and animations (112 lines) |
| `favicon.svg` | Branded favicon |
| `Dockerfile` | nginx:alpine, port 8080 |
| `nginx.conf` | Gzip, caching, security headers |
| `APP-MAP.md` | Application architecture documentation |
| `PROGRESS.md` | This file |

### Infrastructure
- Docker image: nginx:alpine (minimal, ~5MB)
- No database, no backend, no build step
- Coolify auto-deploys on push to master
- Traefik handles routing + SSL

---

## 2026-03-29 — Admin Panel & Analytics System

### Context
Added a full admin panel with security monitoring, visitor analytics, and engagement tracking. The site is no longer purely static — it now has a Node.js/Express backend with SQLite database.

### Architecture Changes
- **Backend**: Node.js + Express replaces nginx as the server (still port 8080)
- **Database**: SQLite via sql.js (pure JS/WASM, no native compilation needed)
- **Auth**: JWT-based login system with bcrypt password hashing
- **Dockerfile**: Changed from `nginx:alpine` to `node:20-alpine`

### What Was Built

#### Server (`server/`)
- `index.js` — Express entry point, static file serving, security headers (helmet), compression
- `db.js` — SQLite initialization, schema creation, admin seeding, sql.js wrapper providing better-sqlite3-like API
- `middleware/auth.js` — JWT token verification middleware
- `routes/auth.js` — Login, password change, admin user CRUD (add/remove admins)
- `routes/track.js` — Visit recording (with UA parsing, bot detection, geo IP lookup via ip-api.com)
- `routes/admin.js` — Dashboard, security, and analytics data aggregation queries
- `utils/detection.js` — Bot UA pattern matching, rate tracking, scanner path detection, suspicious activity logging

#### Admin Panel (`admin/`)
- Single-page app (vanilla JS, no framework)
- Dark theme matching main site (green accent, Inter + JetBrains Mono fonts)
- **Login page** — email/password, forced password change on first login
- **Dashboard** — active visitors, daily/weekly/monthly counts, avg time on site, recent visitors, top referrers
- **Security** — suspicious activity log, bot vs human metrics, top IPs, flagged IPs, full visitor log with ISP/geo
- **Analytics** — visitors over time chart (Chart.js), section engagement, hourly distribution, device/browser breakdown, click tracking, referrer sources, avg scroll depth
- **Settings** — change password, manage admin users (add/remove), new admins get random temp password

#### Tracker (`tracker.js`)
- Lightweight, privacy-respecting (honors DNT)
- Tracks: visits, scroll depth, section visibility (IntersectionObserver), clicks on `data-track` elements, heartbeats (30s), leave events
- Uses `sendBeacon` API for reliable unload tracking

#### Tracked Elements (data-track attributes added to index.html)
- Nav links: `nav-work`, `nav-capabilities`, `nav-process`, `nav-contact`
- Hero CTAs: `cta-see-work`, `cta-start-project`
- Project filters: `filter-all`, `filter-web`, `filter-mobile`, `filter-ai`, `filter-wordpress`
- Project links: `project-nodeai`, `project-predictable`, `project-torahtracker`, `project-davenen`
- Contact: `contact-email`

### Auth System
- First admin: ohavkahalany@gmail.com (seeded on first startup)
- Random password generated at runtime, printed to console logs (nothing hardcoded)
- Must change password on first login
- Can add more admins from Settings page (each gets a random temp password)

### Database Tables
- `config` — JWT secret (auto-generated)
- `users` — admin accounts
- `visits` — visitor sessions with IP, UA, geo, device info, bot flag
- `events` — all tracking events (pageview, click, section_view, heartbeat, leave)
- `suspicious_activity` — flagged security events
- `geo_cache` — IP geolocation cache

### Files Created
| File | Purpose |
|------|---------|
| `server/index.js` | Express server entry point |
| `server/db.js` | SQLite database layer (sql.js wrapper) |
| `server/middleware/auth.js` | JWT authentication middleware |
| `server/routes/auth.js` | Auth & user management API |
| `server/routes/track.js` | Visitor tracking API |
| `server/routes/admin.js` | Admin dashboard data API |
| `server/utils/detection.js` | Bot detection & suspicious activity |
| `admin/index.html` | Admin panel HTML shell |
| `admin/styles.css` | Admin panel dark theme styles |
| `admin/app.js` | Admin panel SPA (all pages) |
| `tracker.js` | Client-side analytics tracker |
| `package.json` | Node.js dependencies |
| `.gitignore` | Excludes node_modules/ and data/ |
| `.dockerignore` | Docker build exclusions |

### Files Modified
| File | Changes |
|------|---------|
| `index.html` | Added `data-track` attributes to nav, CTAs, filters, project links, contact email; added tracker.js script tag; added `id="hero"` to hero section |
| `Dockerfile` | Changed from nginx:alpine to node:20-alpine, runs Express |
| `APP-MAP.md` | Complete rewrite reflecting new architecture |

### Deployment Notes
- **IMPORTANT**: Configure a persistent volume mount for `data/` in Coolify so the SQLite database survives container restarts
- On first deployment, check Coolify logs for the initial admin password
- Admin panel accessible at https://kahalany.dev/admin

---

## 2026-03-29 — Client Portal System (Phase 1: Core Infrastructure)

### Context
Built a full client portal system allowing clients to view project progress, submit tickets, communicate through comments, and approve project plans. Phase 1 covers all server-side infrastructure and both admin/portal frontends.

### Architecture & Security
- **Role-based access control**: `admin`, `staff`, `client` roles with middleware guards
- **Org-scoped data isolation**: Clients only see their own organization's projects (enforced server-side, returns 404 not 403 to prevent enumeration)
- **Internal comments**: Admin/staff can post comments hidden from clients (`is_internal` flag)
- **UUID-based IDs**: All client-facing entities use UUIDs to prevent enumeration attacks
- **Rate limiting**: In-memory per-IP rate limiting (60 req/min for portal, configurable per endpoint group)
- **HMAC-signed dev API**: Prepared for Claude Code integration (replay-protected, time-bounded)
- **Immutable audit trail**: All state-changing actions logged to `activity_log` table

### Database Schema (11 new tables)
- `organizations` — client companies
- `projects` — with lifecycle status (planning → proposed → approved → in_progress → review → completed → maintenance → archived)
- `project_members` — user-project assignments with roles
- `milestones` — project phases with status and sort order
- `tickets` — bug reports, feature requests, tasks, questions
- `ticket_comments` — with `is_internal` flag for admin-only notes
- `ticket_attachments` — prepared for Phase 4 file uploads
- `activity_log` — immutable audit trail
- `project_plans` — versioned project plans for client approval
- `dev_keys` — HMAC keys for Claude Code dev API
- `refresh_tokens` — prepared for token refresh flow

### Server Changes

#### `server/db.js` (modified)
- Added all 11 tables with indexes
- Added ALTER TABLE migrations for users table (org_id, login_attempts, locked_until, last_login_at)
- Added helpers: `generateId()`, `logActivity()`, `slugify()`, `nextTicketNumber()`

#### `server/middleware/auth.js` (rewritten)
- Extended `requireAuth` to include org_id in user query
- Added `requireRole(...roles)` middleware factory
- Added `enforceOrgScope` — verifies project belongs to user's org
- Added `requireDevAuth` — HMAC-SHA256 signature verification (60s replay window)
- Added `rateLimit(maxRequests, windowMs)` with in-memory Map and periodic cleanup

#### `server/routes/admin.js` (major extension)
- Organization CRUD: GET/POST/PATCH `/api/admin/clients`, POST/GET client users
- Project CRUD: GET/POST/PATCH `/api/admin/projects`, GET project detail
- Propose endpoint: POST `/api/admin/projects/:projectId/propose`
- Milestone CRUD with auto-progress recalculation
- Plan management: POST `/api/admin/projects/:projectId/plan`
- Ticket management: GET list, GET detail, PATCH status/priority/assignment
- Comments with internal flag: POST `/api/admin/tickets/:ticketId/comments`
- Dev key management: GET/POST/DELETE `/api/admin/dev-keys`

#### `server/routes/portal.js` (new)
- Client-facing API with `requireAuth` + `rateLimit(60, 60000)`
- Dashboard: projects + recent activity for client's org
- Project detail: milestones, progress, activity (org-scoped)
- Plan viewing + approval (sets status to approved, starts first milestone)
- Ticket list with filters, creation (clients can't set urgent priority)
- Ticket detail with PUBLIC comments only (is_internal = 0)
- Client comment posting (always public)
- Activity feed (filters out internal actions)

#### `server/index.js` (modified)
- Added portal routes (`/api/portal`)
- Added portal static file serving (`/portal`)

### Portal Frontend (`portal/`)
- `index.html` — SPA shell matching admin pattern
- `styles.css` (~400 lines) — same design system as admin (dark theme), portal-specific components (project cards, progress bars, milestone timeline, ticket detail, comments, activity feed)
- `app.js` (~500 lines) — full SPA with hash routing:
  - Login (validates role === 'client', redirects admins to /admin)
  - Dashboard with project cards + recent activity
  - Project view with milestone timeline + progress bar
  - Plan view with approve button
  - Ticket list with filter tabs + creation form
  - Ticket detail with comment thread + reply
  - Activity feed with pagination

### Admin Frontend (`admin/app.js` extended)
- **Projects page**: Project list with create form, progress bars, org select, status management
- **Project detail**: Status dropdown, milestone management (add/edit/delete), plan editor with "Send to Client" button, tickets table, activity log
- **Ticket detail**: Status/priority selects, comment thread with internal note styling (yellow border), post public vs internal comments
- **Clients page**: Organization list with user management, create org form, add client user with temp password display

### Testing Results
- Full end-to-end test: admin login → create org → create client user → create project → add milestones → create plan → propose → client login → view dashboard → view project → approve plan → create ticket → add comments → verify internal comment isolation
- **Critical security verified**: Admin sees 2 comments (1 public + 1 internal), client sees only 1 (public)
- All API endpoints return proper error codes and role-based access works correctly

### Files Created
| File | Purpose |
|------|---------|
| `portal/index.html` | Portal SPA shell |
| `portal/styles.css` | Portal dark theme styles (~400 lines) |
| `portal/app.js` | Portal SPA application (~500 lines) |
| `server/routes/portal.js` | Portal API routes (~255 lines) |
| `CLIENT-PORTAL-PLAN.md` | Full architecture plan (~700 lines) |

### Files Modified
| File | Changes |
|------|---------|
| `server/db.js` | 11 new tables, indexes, helper functions |
| `server/middleware/auth.js` | Complete rewrite with RBAC, org scope, rate limiting, HMAC auth |
| `server/routes/admin.js` | ~400 lines added for project/org/ticket management |
| `server/index.js` | Portal routes + static serving |
| `admin/app.js` | ~400 lines added for projects/clients/ticket management |
| `APP-MAP.md` | Updated with portal architecture |
| `PROGRESS.md` | This entry |

### Remaining Phases
- **Phase 3**: Project Plans & Approval flow polish (plan versioning, markdown editor)
- **Phase 4**: File Uploads & Polish (Multer, email notifications, mobile)
- **Phase 5**: PCG Pilot (real client onboarding)

---

## 2026-03-29 — Google OAuth + Dev API & Claude Integration (Phase 2)

### Google OAuth Infrastructure
- Server-side OAuth2 flow using native `fetch` (no extra npm dependencies)
- Admin configures Google Client ID/Secret in Settings > Google OAuth section
- OAuth config stored in `config` table (key-value): `google_client_id`, `google_client_secret`, `google_oauth_enabled`
- Public status endpoint: `GET /api/auth/oauth/status` — frontend checks if Google sign-in is available
- OAuth flow: `GET /api/auth/google?target=portal|admin` → Google consent → `/api/auth/google/callback`
- CSRF protection via cryptographic state tokens (5-min TTL, in-memory Map)
- Role validation: portal requires `client` role, admin requires `admin/staff`
- Google profile data (`google_id`, `avatar_url`) stored on user record
- "Sign in with Google" button on both portal and admin login pages (conditional on config)
- Admin Settings shows the redirect URI for Google Cloud Console setup
- **Security**: Only works for pre-existing users (admin must create accounts first, no self-registration)

### Dev API (`server/routes/dev.js`)
All endpoints require HMAC-signed auth (`requireDevAuth` middleware).

- `GET /api/dev/sync` — Pull everything changed since last sync for a project (milestones, new/updated/closed tickets with latest comments)
- `GET /api/dev/projects/pending` — List approved but unscaffolded projects (with plan content and milestones)
- `POST /api/dev/projects/:id/scaffolded` — Mark project as scaffolded, set status to `in_progress`, start first milestone
- `POST /api/dev/progress` — Push milestone updates with auto-progress recalculation; auto-advances next milestone on completion; projects move to `review` when all milestones complete
- `POST /api/dev/tickets/:id/resolve` — Close ticket with resolution notes (adds public comment)
- `GET /api/dev/tickets/:id/full` — Complete ticket detail with ALL comments (including internal)
- `POST /api/dev/activity` — Log dev events (code_pushed, deploy_triggered, repo_created, etc.)

### Portal Sync Service (in Claude-Code-Desk-Mobile)
Background service in the Claude Code UI server that keeps local project folders in sync.

**File**: `claude-code-ui-mobile/server/portal-sync.js`

- HMAC-signed API client for kahalany.dev dev endpoints
- Polls every 5 minutes + startup sync (5s delayed)
- **Scaffolding**: Creates project folder in `C:\KDEV\{slug}`, writes `CLAUDE.md` (with plan, milestones, workflow), `.portal.json`, `.portal/tickets/`
- **Pull sync**: Fetches new tickets → writes `.portal/tickets/{number}.md` files; removes closed ticket files; updates `.portal.json` milestone statuses
- **Push sync**: Reads `.portal.json` for dirty milestone updates → pushes to server → clears dirty flags
- **Settings API**: `GET/PATCH /api/settings/portal` for dev API key config, `POST /portal/sync` for manual trigger, `POST /portal/test` for connection test
- Wired into server startup (auto-starts if configured) and graceful shutdown

### CLAUDE.md Template Generator
Generates project-specific `CLAUDE.md` with:
- Project info (portal ID, client, tech stack)
- "On Every Conversation" instructions (read .portal.json, check tickets, update milestones)
- Full project plan content
- Milestone checklist with status indicators
- Workflow instructions for Claude Code

### Files Created
| File | Purpose |
|------|---------|
| `server/routes/dev.js` | Dev API endpoints (~283 lines) |
| `Claude-Code-Desk-Mobile/.../portal-sync.js` | Portal sync service (~300 lines) |

### Files Modified
| File | Changes |
|------|---------|
| `server/routes/auth.js` | Google OAuth flow, config API, status endpoint (~170 lines added) |
| `server/db.js` | Added scaffolded_at column to projects, google_id/avatar_url to users |
| `server/index.js` | Added dev routes |
| `admin/app.js` | Google OAuth settings card in Settings page, "Sign in with Google" on login |
| `portal/app.js` | "Sign in with Google" button on login page with error handling |
| `Claude-Code-Desk-Mobile/.../settings.js` | Portal sync settings endpoints |
| `Claude-Code-Desk-Mobile/.../index.js` | Portal sync startup and shutdown |

---

## 2026-03-29 — Project Plans & Approval Flow (Phase 3)

### Plan Versioning
- New `plan_versions` table stores complete history of every plan edit
- On every save, the current plan content is archived before being overwritten
- Admin endpoints: `GET /plan/versions` (list), `GET /plan/versions/:id` (detail), `POST /plan/restore/:id` (restore)
- Restoring a version saves the current plan as a new version first, then replaces content

### Markdown Rendering
- Lightweight regex-based markdown renderer (no dependencies)
- Supports: headings (h1-h4), bold, italic, code blocks, inline code, lists (ordered/unordered), checkboxes, links, horizontal rules
- Admin plan editor has Write/Preview tabs with live markdown preview
- Portal plan view renders markdown (was previously raw text)

### Approval Workflow Polish
- Portal plan page now shows "Approve Project" and "Request Changes" side by side
- "Request Changes" opens inline feedback form that creates a ticket (type: `modification`) for the team
- Plan nav item added to portal sidebar for easy access
- Admin can re-propose plans after making changes ("Re-send to Client")
- Save button shows inline version badge feedback (`Saved (v3)`) without page reload
- Admin version history panel: view any previous version, restore with one click

### Files Modified
| File | Changes |
|------|---------|
| `server/db.js` | Added `plan_versions` table |
| `server/routes/admin.js` | Version history, view, restore endpoints; versioned save |
| `admin/app.js` | Markdown renderer, Write/Preview tabs, version history panel |
| `portal/app.js` | Markdown renderer, "Request Changes" feedback form, Plan nav item |

### Remaining Phases
- **Phase 4**: File Uploads & Polish (Multer, email notifications, mobile)
- **Phase 5**: PCG Pilot (real client onboarding)

---

## 2026-03-29 — File Uploads & Attachment UI (Phase 4)

### File Upload System
- Installed `multer` for multipart file handling
- `server/routes/uploads.js` — full CRUD file upload API (~200 lines)
  - **POST /api/uploads/tickets/:ticketId** — upload files with org-scope verification
  - **GET /api/uploads/tickets/:ticketId** — list attachments with uploader name
  - **GET /api/uploads/download/:attachmentId** — auth-gated download with Content-Disposition
  - **DELETE /api/uploads/:attachmentId** — admin/staff or uploader can delete

### Security
- UUID-based stored filenames (prevents path traversal while keeping original name in DB)
- MIME whitelist: images, PDFs, Office docs, text, CSV, ZIP
- Extension blacklist: executables, scripts, DLLs (defense-in-depth)
- 10MB per file limit, 10 files per ticket limit
- Downloads forced via `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`
- Auth-gated downloads (JWT required via fetch + blob URL)

### Attachment UI
- **Admin ticket detail**: Attachments card with file list (icon, name, size, uploader, date), drag-and-drop upload zone, download via authenticated fetch, delete with confirmation
- **Portal ticket detail**: Same attachment card (hidden upload zone when ticket is closed), clients can only delete their own uploads
- File type icons based on MIME type (images, PDFs, docs, spreadsheets, archives, generic)
- `formatFileSize()` helper added to both admin and portal apps

### Files Created
| File | Purpose |
|------|---------|
| `server/routes/uploads.js` | File upload/download/delete API |

### Files Modified
| File | Changes |
|------|---------|
| `server/index.js` | Added upload routes |
| `admin/app.js` | Attachment section in ticket detail, formatFileSize helper |
| `portal/app.js` | Attachment section in ticket detail, formatFileSize helper |
| `package.json` | Added multer dependency |

### Remaining Phases
- **Phase 5**: PCG Pilot (real client onboarding)

---

## Future Enhancements
- [ ] Add real screenshots alongside or replacing CSS mockups
- [ ] Add more contact methods (phone, WhatsApp, Calendly)
- [ ] Add OG meta tags + OG image for social sharing
- [ ] Add light theme toggle
- [ ] Consider adding a blog/case-studies section
- [x] ~~Add analytics (Plausible or similar privacy-respecting)~~ — Built custom analytics system
- [ ] Add IP blocking capability from admin panel
- [ ] Add email alerts for high-severity suspicious activity
- [ ] Add data export (CSV) from admin panel
- [ ] Add real-time WebSocket updates to admin dashboard
