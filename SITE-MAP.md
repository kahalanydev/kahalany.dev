# kaymen.dev — Site Map

> Complete map of all domains, routes, pages, and API endpoints.
> Last updated: 2026-04-06

---

## Domains & Subdomains

| Domain | Points To | SSL | Purpose |
|--------|-----------|-----|---------|
| `kaymen.dev` | `178.156.245.71` (A record) | Let's Encrypt | Main portfolio site + admin + portal |
| `kahalany.dev` | `178.156.245.71` (A record) | Let's Encrypt | Legacy domain (parallel, to be retired) |
| `nodeai.kaymen.dev` | `178.156.245.71` (wildcard) | Let's Encrypt | NodeAI app |
| `predictable.kaymen.dev` | `178.156.245.71` (wildcard) | Let's Encrypt | Predictable stock analysis |
| `davenen.kaymen.dev` | `178.156.245.71` (wildcard) | Let's Encrypt | Davenen prayer partner app |
| `shipai.kaymen.dev` | `178.156.245.71` (wildcard) | Let's Encrypt | ShipHero AI warehouse assistant |
| `pcg.kaymen.dev` | `178.156.245.71` (wildcard) | Let's Encrypt | Passaic Clifton Gemach |
| `torahtracker.kaymen.dev` | `178.156.245.71` (wildcard) | Let's Encrypt | Torah Tracker |
| `torahtracker.app` | `178.156.245.71` (A record) | Let's Encrypt | Torah Tracker (primary domain) |
| `davenen.org` | external | — | Davenen (primary domain) |
| `code.kaymen.dev` | Cloudflare Tunnel | Cloudflare | Claude Code Desktop server |
| `admin.kahalany.dev` | `178.156.245.71` | Let's Encrypt | Coolify dashboard |

### DNS Configuration (Cloudflare — kaymen.dev zone)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `178.156.245.71` | DNS only |
| A | `*` | `178.156.245.71` | DNS only |
| CNAME | `code` | `[tunnel-id].cfargotunnel.com` | Proxied (auto by tunnel) |
| MX | `@` | Cloudflare Email Routing | — |

### Email

| Address | Forwards To |
|---------|-------------|
| `hello@kaymen.dev` | kahalanydev@gmail.com (Cloudflare Email Routing) |
| `hello@kahalany.dev` | kahalanydev@gmail.com (Cloudflare Email Routing) |

---

## Site Structure — kaymen.dev

### Public Pages

```
https://kaymen.dev/
├── /                          Main portfolio site (single page)
│   ├── #hero                  Hero section (rotating text, stats, CTAs)
│   ├── #work                  Portfolio (11 project cards, filter bar)
│   ├── #capabilities          6 capability cards
│   ├── #process               4-step timeline
│   └── #contact               Contact form + WhatsApp + email
│
├── /admin/                    Admin panel (SPA, requires login)
│   ├── Dashboard              Metrics, active projects, activity feed, visitors, contacts
│   ├── Security               Bot detection, suspicious activity, flagged IPs
│   ├── Analytics              Charts (visitors, sections, devices, clicks, referrers)
│   └── Settings               Account, integrations, dev keys, team management
│
└── /portal/                   Client portal (SPA, requires login)
    ├── Dashboard              Project cards with progress rings, milestones, tickets
    ├── Project View           Phase indicator, milestone timeline, activity feed
    ├── Plan View              Project plan display + approval
    ├── Tickets                Create/view/filter tickets, comment threads
    └── Activity Feed          Paginated activity log
```

### Static Assets

```
https://kaymen.dev/
├── index.html                 Main site
├── styles.css                 Main site styles
├── script.js                  Main site interactions
├── tracker.js                 Analytics tracker
├── favicon.svg                Branded "K" icon
├── admin/
│   ├── index.html             Admin shell
│   ├── app.js                 Admin SPA
│   ├── styles.css             Admin styles
│   ├── manifest.json          PWA manifest
│   └── sw.js                  Service worker
└── portal/
    ├── index.html             Portal shell
    ├── app.js                 Portal SPA
    ├── styles.css             Portal styles
    ├── manifest.json          PWA manifest
    └── sw.js                  Service worker
```

---

## API Endpoints

### Auth (`/api/auth/*`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | Public | Login (returns JWT) |
| POST | `/api/auth/change-password` | JWT | Change own password |
| GET | `/api/auth/users` | Admin | List all users |
| POST | `/api/auth/users` | Admin | Create user (admin/staff/client) |
| DELETE | `/api/auth/users/:id` | Admin | Remove user |
| GET | `/api/auth/smtp` | Admin | Get SMTP config |
| POST | `/api/auth/smtp` | Admin | Update SMTP config |
| POST | `/api/auth/smtp/test` | Admin | Send test email |
| GET | `/api/auth/google-config` | Admin | Get Google OAuth config |
| POST | `/api/auth/google-config` | Admin | Update Google OAuth config |
| POST | `/api/auth/google-login` | Public | Google OAuth login |

### Tracking (`/api/track/*`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/track/visit` | Public | Record visitor session |
| POST | `/api/track/event` | Public | Record tracking event |

### Admin (`/api/admin/*` — requires JWT + admin/staff role)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/dashboard` | Dashboard metrics + recent data |
| GET | `/api/admin/security` | Security metrics + suspicious activity |
| GET | `/api/admin/analytics` | Analytics data (charts, tables) |
| GET | `/api/admin/orgs` | List organizations |
| POST | `/api/admin/orgs` | Create organization |
| GET | `/api/admin/orgs/:id` | Organization detail + users |
| POST | `/api/admin/orgs/:id/users` | Add user to org |
| GET | `/api/admin/projects` | List all projects |
| POST | `/api/admin/projects` | Create project |
| GET | `/api/admin/projects/:id` | Project detail (milestones, tickets, members, activity) |
| PUT | `/api/admin/projects/:id` | Update project |
| POST | `/api/admin/projects/:id/milestones` | Add milestone |
| PUT | `/api/admin/milestones/:id` | Update milestone |
| POST | `/api/admin/projects/:id/members` | Add project member |
| DELETE | `/api/admin/members/:id` | Remove project member |
| GET | `/api/admin/tickets` | List all tickets |
| PUT | `/api/admin/tickets/:id` | Update ticket (status, priority, assignee) |
| POST | `/api/admin/tickets/:id/comments` | Add comment to ticket |
| POST | `/api/admin/projects/:id/plans` | Create/update project plan |
| GET | `/api/admin/dev-keys` | List dev API keys |
| POST | `/api/admin/dev-keys` | Create dev API key |
| DELETE | `/api/admin/dev-keys/:id` | Revoke dev API key |
| GET | `/api/admin/dev-diagnostics` | Dev API diagnostic info |

### Portal (`/api/portal/*` — requires JWT + org-scoped)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/portal/dashboard` | Client dashboard (projects, milestones, tickets) |
| GET | `/api/portal/projects/:id` | Project detail (org-scoped) |
| GET | `/api/portal/projects/:id/tickets` | Project tickets |
| POST | `/api/portal/projects/:id/tickets` | Create ticket |
| GET | `/api/portal/tickets/:id` | Ticket detail + comments |
| POST | `/api/portal/tickets/:id/comments` | Add comment |
| GET | `/api/portal/projects/:id/activity` | Activity feed |
| GET | `/api/portal/projects/:id/plan` | View project plan |
| POST | `/api/portal/projects/:id/plan/approve` | Approve project plan |

### Dev API (`/api/dev/*` — requires HMAC signature)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/dev/bootstrap` | Create org + project (idempotent) |
| GET | `/api/dev/sync` | Pull changes since last sync |
| GET | `/api/dev/projects/pending` | List approved unscaffolded projects |
| POST | `/api/dev/projects/:id/scaffolded` | Mark project scaffolded |
| POST | `/api/dev/projects/:id/update` | Update project metadata |
| POST | `/api/dev/projects/:id/milestones` | Bulk create milestones |
| POST | `/api/dev/progress` | Push milestone updates |
| POST | `/api/dev/tickets/:id/resolve` | Close ticket |
| GET | `/api/dev/tickets/:id/full` | Full ticket detail |
| POST | `/api/dev/activity` | Log dev events |

### Other

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/contact` | Public (rate-limited) | Contact form submission |
| POST | `/api/uploads/upload` | JWT | Upload file |
| GET | `/api/uploads/:filename` | JWT | Download file |
| DELETE | `/api/uploads/:filename` | JWT | Delete file |

---

## Server-Side File Structure

```
server/
├── index.js                   Express entry point (port 8080)
│                              Static serving, contact form, security headers
├── db.js                      SQLite init (sql.js), 17+ table schema, admin seed
├── middleware/
│   └── auth.js                JWT auth, role checks, org scope, HMAC verify, rate limit
├── routes/
│   ├── auth.js                Login, users, SMTP, Google OAuth
│   ├── track.js               Visit + event recording
│   ├── admin.js               Admin dashboard, security, analytics, project CRUD
│   ├── portal.js              Client portal APIs (org-scoped)
│   ├── dev.js                 Dev API (HMAC-signed, for Claude Code sync)
│   └── uploads.js             File upload/download/delete
└── utils/
    ├── detection.js            Bot detection, rate tracking, suspicious activity
    └── email.js                Nodemailer SMTP (welcome, reset, contact, tickets)
```

---

## Coolify App Registry

| App | UUID | Branch | Domain(s) |
|-----|------|--------|-----------|
| Main site | `zcco40skss0o8wwocs40k4gs` | master | `kahalany.dev, kaymen.dev` |
| NodeAI | `gw840cgk8gscowck8kc80wo8` | master | `nodeai.kahalany.dev, nodeai.kaymen.dev` |
| Predictable | `og8w4kkkccw4ckcsgw4ws8sw` | master | `predictable.kahalany.dev, predictable.kaymen.dev` |
| Davenen | `cco0kccokg08okwsw8cssk48` | master | `davenen.kahalany.dev, davenen.kaymen.dev` |
| ShipHero AI | `o00gossow4c8s888ws48okso` | master | `shipai.kahalany.dev, shipai.kaymen.dev` |
| PCG | `nwg0s00oc8k8owo0sggkgkgg` | master | `pcg.kahalany.dev, pcg.kaymen.dev` |
| Torah Tracker | `dc4ccksssskkww0ckc00sg4s` | master | `torahtracker.app, torahtracker.kahalany.dev, torahtracker.kaymen.dev` |

### Staging Apps

| App | UUID | Branch | Domain |
|-----|------|--------|--------|
| PCG Staging | `q4wsgoc88448skcswgw08s8c` | develop | `staging.pcg.kahalany.dev` |
| ShipHeroAI Staging | `uo804sgww808gck8kcsk4gs4` | develop | `staging.shipai.kahalany.dev` |
| Davenen Staging | `x0kgswoo0skokwk8coosg0c0` | develop | `staging.davenen.kahalany.dev` |
| Torah Tracker Staging | `q8c0w8k48g4s00sgwwwcowk4` | develop | `staging.torahtracker.kahalany.dev` |
| NodeAI Staging | `okgk8kkkoogsgwo0kg4sc8gc` | develop | `staging.nodeai.kahalany.dev` |

---

## Portfolio Projects (index.html)

| # | Project | Domain | Mockup URL | Live Link | Tags |
|---|---------|--------|-----------|-----------|------|
| 1 | NodeAI | `nodeai.kaymen.dev` | `nodeai.kaymen.dev` | Yes | web, ai |
| 2 | Predictable | `predictable.kaymen.dev` | `predictable.kaymen.dev` | Yes | ai, web |
| 3 | OLAMI Command Center | External (WordPress) | `olami-command-center` | No | wordpress, web |
| 4 | Torah Tracker | `torahtracker.app` | (phone mockup) | Yes | mobile, web |
| 5 | ShipHero AI | `shipai.kaymen.dev` | `shipai.kaymen.dev` | Yes | ai, web |
| 6 | Davenen Partner | `davenen.kaymen.dev` | `davenen.kaymen.dev` | Yes | web |
| 7 | Community Lending (PCG) | `pcg.kaymen.dev` | `pcg.kaymen.dev` | Yes | web |
| 8 | Hero Animator | WordPress plugin | `hero-animator` | No | wordpress, web |
| 9 | SnapGrid Pro | WordPress plugin | `snapgrid-pro` | No | wordpress, web |
| 10 | Claude Code UI | Desktop app | `Claude Code UI.exe` | No | ai |
| 11 | Client Management Portal | This site's portal | `portal.example.com/admin` | No | web |

---

## Auth & Access Model

```
                    ┌─────────────┐
                    │   Public    │  Main site, contact form, tracker
                    └──────┬──────┘
                           │ Login
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Admin   │ │  Staff   │ │  Client  │
        │          │ │          │ │          │
        │ Full     │ │ Project  │ │ Portal   │
        │ access   │ │ mgmt     │ │ only     │
        │ /admin   │ │ /admin   │ │ /portal  │
        └──────────┘ └──────────┘ └──────────┘
                                       │
                                  Org-scoped
                                  (sees only own
                                   org's data)
```

- **JWT tokens**: 24h expiry, stored in localStorage
- **Admin/Staff**: Access `/admin` panel
- **Client**: Access `/portal` only, org-scoped isolation (returns 404 not 403)
- **Dev API**: HMAC-SHA256 signed requests (60s replay window)
- **Rate limiting**: 60 req/min per IP (portal), configurable per endpoint

---

## Database (SQLite — 17+ tables)

### Core
| Table | Purpose |
|-------|---------|
| `config` | Key/value store (JWT secret, SMTP, OAuth) |
| `users` | All accounts (admin, staff, client) |
| `visits` | Visitor sessions |
| `events` | Tracking events |
| `suspicious_activity` | Flagged security events |
| `geo_cache` | IP geolocation cache |
| `contact_submissions` | Contact form entries |
| `contact_dismissals` | Dismissed contacts |

### Client Portal
| Table | Purpose |
|-------|---------|
| `organizations` | Client companies |
| `projects` | Projects with status machine |
| `project_members` | User-project assignments |
| `milestones` | Project phases |
| `tickets` | Bug reports, features, tasks |
| `ticket_comments` | With `is_internal` flag |
| `ticket_attachments` | File uploads |
| `activity_log` | Immutable audit trail |
| `project_plans` | Versioned plans for approval |
| `dev_keys` | HMAC keys for dev API |
| `refresh_tokens` | Token refresh flow |
