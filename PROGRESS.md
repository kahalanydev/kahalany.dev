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
