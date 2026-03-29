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
│   ├── index.js            # Express entry point (port 8080)
│   ├── db.js               # SQLite init, schema, wrapper (sql.js), admin seeding
│   ├── middleware/
│   │   └── auth.js         # JWT auth middleware (requireAuth)
│   ├── routes/
│   │   ├── auth.js         # POST /api/auth/login, /change-password, GET/POST/DELETE /api/auth/users
│   │   ├── track.js        # POST /api/track/visit, /api/track/event
│   │   └── admin.js        # GET /api/admin/dashboard, /security, /analytics
│   └── utils/
│       └── detection.js    # Bot detection, rate tracking, suspicious activity logging
├── admin/
│   ├── index.html          # Admin panel shell (loads Chart.js + app.js)
│   ├── styles.css          # Admin dark theme styles
│   └── app.js              # Admin SPA (login, dashboard, security, analytics, settings)
├── data/
│   └── analytics.db        # SQLite database (gitignored, persisted via Docker volume)
├── package.json            # Node.js deps: express, sql.js, bcryptjs, jsonwebtoken, helmet, etc.
├── Dockerfile              # node:20-alpine, port 8080
├── .dockerignore           # Excludes node_modules, data, .git, *.md
├── .gitignore              # Excludes node_modules/, data/
├── nginx.conf              # Legacy reference (no longer used — Express serves everything)
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
  ├── /api/auth/*          → auth routes (JWT login, user management)
  ├── /api/track/*         → tracking endpoints (visits, events)
  ├── /api/admin/*         → admin data API (requires JWT)
  └── 404                  → suspicious activity logger
```

### Database Schema (SQLite)
- **config** — key/value store (JWT secret)
- **users** — admin accounts (email, bcrypt hash, must_change_password flag)
- **visits** — visitor sessions (IP, UA, geo, device, referrer, bot flag)
- **events** — tracking events (pageview, click, section_view, heartbeat, leave)
- **suspicious_activity** — flagged events (rate spikes, scanner paths, bot UAs)
- **geo_cache** — IP geolocation cache (from ip-api.com)

### Auth System
- JWT tokens (24h expiry), secret auto-generated and stored in DB
- First admin seeded on startup with random password (printed to console logs)
- `must_change_password` flag forces password change on first login
- Admins can add/remove other admins via Settings page

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

## Deployment
- **Docker**: `node:20-alpine` runs Express on port 8080
- **Coolify**: public repo, auto-deploy on push to `master`
- **Traefik**: routes `kahalany.dev` → container:8080, auto-SSL
- **Persistent storage**: `data/` directory must be mounted as a Docker volume in Coolify for DB persistence
- **First run**: check Coolify deployment logs for the initial admin password
