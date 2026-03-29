# Kahalany.Dev — Application Map

## Overview
Portfolio/showcase website for Kahalany.Dev — a custom software development practice. Node.js/Express backend with SQLite analytics database, admin panel, and visitor tracking. Deployed via Docker on Coolify. Showcases 8 production projects with CSS device mockups, project filtering, and responsive design.

- **Live URL**: https://kahalany.dev
- **Repo**: https://github.com/kahalanydev/kahalany.dev
- **Coolify UUID**: `zcco40skss0o8wwocs40k4gs`

## Tech Stack
- **Frontend** — vanilla HTML/CSS/JS, no framework, no build step
- **Backend** — Node.js + Express
- **Database** — SQLite via sql.js (WASM, pure JS — no native deps)
- **Auth** — JWT tokens + bcrypt password hashing
- **Charts** — Chart.js 4.x (CDN) in admin panel
- **Fonts** — Inter (body) + JetBrains Mono (code/accents) via Google Fonts
- **Deployment** — Node.js Docker container on Coolify (Hetzner VPS)
- **SSL** — Let's Encrypt via Traefik (auto-provisioned)
- **Domain** — kahalany.dev on Cloudflare (DNS only, not proxied)
- **Email** — hello@kahalany.dev via Cloudflare Email Routing → kahalanydev@gmail.com

## File Structure
```
Kahalany.Dev Site/
├── index.html              # Main site (single-page, 5 sections)
├── styles.css              # All styles including CSS device mockups (~1400 lines)
├── script.js               # Main site interactions: nav, filters, counters, animations
├── tracker.js              # Lightweight analytics tracker (scroll, clicks, sections)
├── favicon.svg             # Branded "K" favicon (SVG)
├── server/
│   ├── index.js            # Express entry point (port 8080), routes + static serving
│   ├── db.js               # SQLite init, schema (17 tables), wrapper, admin seeding, helpers
│   ├── middleware/
│   │   └── auth.js         # Auth: requireAuth, requireRole, enforceOrgScope, requireDevAuth, rateLimit
│   ├── routes/
│   │   ├── auth.js         # POST /api/auth/login, /change-password, GET/POST/DELETE /api/auth/users
│   │   ├── track.js        # POST /api/track/visit, /api/track/event
│   │   ├── admin.js        # Admin API: dashboard, security, analytics, orgs, projects, milestones, tickets, plans, dev-keys
│   │   └── portal.js       # Portal API: dashboard, projects, tickets, comments, activity, plan approval
│   └── utils/
│       └── detection.js    # Bot detection, rate tracking, suspicious activity logging
├── admin/
│   ├── index.html          # Admin panel shell (loads Chart.js + app.js)
│   ├── styles.css          # Admin dark theme styles
│   └── app.js              # Admin SPA (dashboard, security, analytics, settings, projects, clients, tickets)
├── portal/
│   ├── index.html          # Client portal shell
│   ├── styles.css          # Portal dark theme styles (shared design system with admin)
│   └── app.js              # Portal SPA (login, dashboard, projects, tickets, plans, activity)
├── data/
│   └── analytics.db        # SQLite database (gitignored, persisted via Docker volume)
├── package.json            # Node.js deps: express, sql.js, bcryptjs, jsonwebtoken, helmet, etc.
├── Dockerfile              # node:20-alpine, port 8080
├── .dockerignore           # Excludes node_modules, data, .git, *.md
├── .gitignore              # Excludes node_modules/, data/
├── nginx.conf              # Legacy reference (no longer used — Express serves everything)
├── CLIENT-PORTAL-PLAN.md   # Full client portal architecture & implementation plan
├── APP-MAP.md              # This file
├── PROGRESS.md             # Development log
└── CLAUDE.md               # Claude Code instructions
```

## Architecture

### Request Flow
```
Client → Traefik (SSL) → Express (:8080)
  ├── /                    → static index.html + assets
  ├── /admin               → admin SPA (admin/index.html)
  ├── /portal              → client portal SPA (portal/index.html)
  ├── /api/auth/*          → auth routes (JWT login, user management)
  ├── /api/track/*         → tracking endpoints (visits, events)
  ├── /api/admin/*         → admin data API (requires JWT + admin/staff role)
  ├── /api/portal/*        → portal data API (requires JWT + org-scoped access)
  └── 404                  → suspicious activity logger
```

### Database Schema (SQLite — 17 tables)

**Core (existing)**:
- **config** — key/value store (JWT secret)
- **users** — all accounts: admin, staff, client (email, bcrypt hash, role, org_id)
- **visits** — visitor sessions (IP, UA, geo, device, referrer, bot flag)
- **events** — tracking events (pageview, click, section_view, heartbeat, leave)
- **suspicious_activity** — flagged events (rate spikes, scanner paths, bot UAs)
- **geo_cache** — IP geolocation cache (from ip-api.com)

**Client Portal (new)**:
- **organizations** — client companies
- **projects** — with lifecycle status machine (planning → proposed → approved → in_progress → review → completed → maintenance → archived)
- **project_members** — user-project assignments with roles
- **milestones** — project phases with status and sort order
- **tickets** — bug reports, feature requests, tasks, modifications, questions
- **ticket_comments** — with `is_internal` flag for admin-only notes
- **ticket_attachments** — prepared for file uploads
- **activity_log** — immutable audit trail for all state changes
- **project_plans** — versioned plans for client approval
- **dev_keys** — HMAC keys for Claude Code dev API
- **refresh_tokens** — prepared for token refresh flow

### Auth System
- JWT tokens (24h expiry), secret auto-generated and stored in DB
- First admin seeded on startup with random password (printed to console logs)
- `must_change_password` flag forces password change on first login
- Admins can add/remove other admins via Settings page
- **Role-based access**: `admin` (full access), `staff` (project management), `client` (portal only)
- **Org-scoped isolation**: Clients only see their own organization's data (returns 404 not 403)
- **Rate limiting**: In-memory per-IP limiting (60 req/min portal, configurable per endpoint)
- **HMAC dev API**: Prepared for Claude Code integration (SHA-256 signatures, 60s replay window)

### Tracker (tracker.js)
- Respects Do Not Track (DNT) header
- Generates session ID (sessionStorage)
- Tracks: page visits, scroll depth, section visibility, clicks on `data-track` elements
- Sends heartbeat every 30s, leave event on page unload
- Uses `sendBeacon` API for reliability

### Suspicious Activity Detection
- In-memory rate tracking per IP (>30/min = medium, >60/min = high)
- Bot user agent pattern matching (scanners, crawlers, automated tools)
- Scanner path detection (wp-admin, .env, phpmyadmin, etc.)
- All 404s logged with IP and UA for analysis

## Site Sections

### 1. Navigation
- Fixed top nav with blur backdrop on scroll
- Logo: `{ kahalany.dev }` in JetBrains Mono
- Links: Work, Capabilities, Process, Let's Talk (CTA)
- Mobile: hamburger → fullscreen overlay menu
- All nav links have `data-track` attributes

### 2. Hero
- Rotating text animation: "ships" / "scales" / "works" / "lasts"
- Green pulse "Available for new projects" badge
- Animated counters: 14+ Production Apps, 6 Tech Stacks, 5 Live Platforms
- Two CTAs: "See Our Work" / "Start a Project" (tracked)
- Subtle grid background + radial glow

### 3. Portfolio (Work)
- **Filter bar**: All / Web Apps / Mobile / AI·ML / WordPress (tracked)
- **8 project cards**, each with CSS device mockup, tech tags, status badge
- "View Live" links for deployed projects (tracked)
- Filter uses `data-tags` attributes, JS toggles `.hidden` class

### 4. Capabilities
- 6 cards in 3-column responsive grid

### 5. Process ("How We Work")
- 4-step vertical timeline

### 6. Contact
- Email link: hello@kahalany.dev (tracked)
- Code block visual (`new-project.ts`)

### 7. Footer
- Logo, nav links, copyright

## Admin Panel Pages

### Login
- Email/password form, JWT stored in localStorage
- Force password change on first login

### Dashboard
- Metric cards: Active Now, Today, This Week, This Month, Avg Time, Total
- Recent Visitors table (IP, location, browser, device, time)
- Top Referrers table

### Security
- Alert banner for high-severity events
- Metrics: Human vs Bot counts, Suspicious events, Unique IPs
- Suspicious Activity log table (severity, IP, reason, details)
- Top IPs table with bot/human badges
- Flagged IPs table (aggregated incidents)
- Full Visitor Log with ISP info

### Analytics
- Visitors line chart (last 30 days, Chart.js)
- Section engagement horizontal bar chart
- Visits by hour bar chart
- Device breakdown doughnut chart
- Click tracking table
- Referrer sources table
- Browser breakdown table
- Average scroll depth metric

### Settings
- Change password form
- Admin user management (list, add, remove)
- New admin gets random temp password (must change on first login)

## Client Portal Pages

### Login
- Email/password form, JWT stored in localStorage as `portal_token`
- Validates role === 'client', redirects admin/staff to /admin

### Dashboard
- Project cards with progress bars and status badges
- Recent activity feed across all org projects
- Quick links to project details

### Project View
- Milestone timeline with status indicators (upcoming, in_progress, completed)
- Progress bar (auto-calculated from milestone completion)
- Open ticket count, recent activity

### Plan View
- Project plan content display
- Approve button (only for `proposed` status projects)
- Approval triggers project start + first milestone activation

### Tickets
- Filter tabs: All, Open, In Progress, Closed
- Type and priority filters
- Create new ticket form (types: task, bug, feature_request, modification, question)
- Ticket detail with comment thread and reply form
- Internal comments hidden from clients

### Activity Feed
- Paginated activity log for project
- Filters out internal actions automatically

## Admin Panel Extensions (Client Portal)

### Projects Page
- Project list with progress bars, status badges, org assignment
- Create project form with org selection
- Project detail: status management, milestone CRUD, plan editor, ticket list, activity log

### Clients Page
- Organization list with user counts
- Create organization form
- Add client users with temporary password generation

### Ticket Management
- Status/priority/assignment controls
- Comment thread with internal note option (yellow-bordered)
- Post as public or internal comment

## Deployment
- **Docker**: `node:20-alpine` runs Express on port 8080
- **Coolify**: public repo, auto-deploy on push to `master`
- **Traefik**: routes `kahalany.dev` → container:8080, auto-SSL
- **Persistent storage**: `data/` directory must be mounted as a Docker volume in Coolify for DB persistence
- **First run**: check Coolify deployment logs for the initial admin password
