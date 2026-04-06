# Rebranding Plan: kahalany.dev → kaymen.dev

> **Date**: April 5, 2026
> **Status**: Planning
> **Domain**: kaymen.dev (purchased)
> **Entity**: Kaymen Group LLC

---

## Overview

Full rebrand of the dev practice from "Kahalany.Dev" to "kaymen.dev", operating as the development department of Kaymen Group LLC. The nav logo in index.html is already updated — everything else (107 occurrences across 23 files) still references "kahalany".

The favicon (a "K" letter with blue-purple gradient) is reusable since both brands start with K.

---

## Decisions To Make

| # | Question | Options | Recommended |
|---|----------|---------|-------------|
| 1 | Where should hello@kaymen.dev forward to? | Same kahalanydev@gmail.com / New kaymendev@gmail.com / Google Workspace | Same Gmail |
| 2 | GitHub strategy | Rename org+repo / New org + transfer / Fresh repo | Rename (preserves history) |
| 3 | Copyright line | "Kaymen Group LLC" / "kaymen.dev" | Kaymen Group LLC |
| 4 | Brand casing | kaymen.dev (lowercase) / Kaymen.Dev (capitalized) | kaymen.dev (matches nav) |

---

## Phase 1: Code Changes

### 1.1 Main Site — index.html

| Line | What | Current | New |
|------|------|---------|-----|
| 6 | Page title | `Kahalany.Dev — Custom Software Solutions` | `kaymen.dev — Custom Software Solutions` |
| 95 | Mockup URL | `nodeai.kahalany.dev` | `nodeai.kaymen.dev` |
| 150 | Live link href | `https://nodeai.kahalany.dev` | `https://nodeai.kaymen.dev` |
| 159 | Mockup URL | `predictable.kahalany.dev` | `predictable.kaymen.dev` |
| 210 | Live link href | `https://predictable.kahalany.dev` | `https://predictable.kaymen.dev` |
| 388 | Mockup URL | `davenen.kahalany.dev` | `davenen.kaymen.dev` |
| 427 | Live link href | `https://davenen.kahalany.dev` | `https://davenen.kaymen.dev` |
| 895 | Contact mailto | `mailto:hello@kahalany.dev` | `mailto:hello@kaymen.dev` |
| 899 | Contact display | `hello@kahalany.dev` | `hello@kaymen.dev` |
| 912 | Footer logo | `{ kahalany.dev }` | `{ kaymen.dev }` |
| 919 | Copyright | `© 2026 Kahalany.Dev` | `© 2026 Kaymen Group LLC` |

### 1.2 Admin Panel — admin/app.js

| Line | What | Current | New |
|------|------|---------|-----|
| 1 | File comment | `/* Admin Panel SPA — kahalany.dev */` | `/* Admin Panel SPA — kaymen.dev */` |
| 216 | Device name | `'Kahalany Admin Panel'` | `'Kaymen Admin Panel'` |
| 409 | Login logo | `kahalany.dev` | `kaymen.dev` |
| 486 | Login logo | `kahalany.dev` | `kaymen.dev` |
| 548 | Sidebar logo | `kahalany.dev` | `kaymen.dev` |
| 1268 | CC server URL | `code.kahalany.dev` (value + placeholder) | `code.kaymen.dev` |
| 1307 | SMTP placeholder | `"Kahalany.Dev" <hello@kahalany.dev>` | `"kaymen.dev" <hello@kaymen.dev>` |
| 2980 | Login logo | `kahalany.dev` | `kaymen.dev` |

### 1.3 Client Portal — portal/app.js

| Line | What | Current | New |
|------|------|---------|-----|
| 1 | File comment | `/* Client Portal SPA — kahalany.dev */` | `/* Client Portal SPA — kaymen.dev */` |
| 260 | Login logo | `kahalany.dev` | `kaymen.dev` |
| 301 | Login logo | `kahalany.dev` | `kaymen.dev` |
| 355 | Sidebar logo | `kahalany.dev` | `kaymen.dev` |
| 1213 | Login logo | `kahalany.dev` | `kaymen.dev` |

### 1.4 HTML Page Titles

| File | Line | Current | New |
|------|------|---------|-----|
| admin/index.html | 6 | `Admin — kahalany.dev` | `Admin — kaymen.dev` |
| portal/index.html | 6 | `Client Portal — kahalany.dev` | `Client Portal — kaymen.dev` |

### 1.5 PWA Manifests

**admin/manifest.json**:

| Field | Current | New |
|-------|---------|-----|
| name | `Kahalany.Dev Admin` | `kaymen.dev Admin` |
| short_name | `KD Admin` | `KD Admin` (no change — K still works) |
| description | `Admin panel for kahalany.dev` | `Admin panel for kaymen.dev` |

**portal/manifest.json**:

| Field | Current | New |
|-------|---------|-----|
| name | `Kahalany.Dev Portal` | `kaymen.dev Portal` |
| short_name | `KD Portal` | `KD Portal` (no change) |
| description | `Client portal for kahalany.dev` | `Client portal for kaymen.dev` |

### 1.6 Server Files

**server/index.js** (line 78):
- `to: 'hello@kahalany.dev'` → `to: 'hello@kaymen.dev'`

**server/utils/email.js**:

| Line | What | Current | New |
|------|------|---------|-----|
| 50 | Comment | `{ kahalany.dev } logo` | `{ kaymen.dev } logo` |
| 56 | Email HTML logo | `kahalany` (styled text) | `kaymen` |
| 70 | Invite subject | `You've been invited to Kahalany.Dev` | `You've been invited to kaymen.dev` |
| 91 | Reset subject | `Your Kahalany.Dev password has been reset` | `Your kaymen.dev password has been reset` |

**server/routes/auth.js** (line 274):
- `'Kahalany.Dev — SMTP Test'` → `'kaymen.dev — SMTP Test'`

**server/routes/dev.js**:

| Line | What | Current | New |
|------|------|---------|-----|
| 25 | Default org email | `'hello@kahalany.dev'` | `'hello@kaymen.dev'` |
| 379 | Portal URL | `'https://kahalany.dev/portal'` | `'https://kaymen.dev/portal'` |

### 1.7 Package Config

**package.json**:

| Field | Current | New |
|-------|---------|-----|
| name | `kahalany-dev-site` | `kaymen-dev-site` |
| description | `Kahalany.Dev portfolio site with admin analytics panel` | `kaymen.dev portfolio site with admin analytics panel` |

Then run `npm install` to regenerate package-lock.json automatically.

### 1.8 Comment-Only Files

| File | Line | Current | New |
|------|------|---------|-----|
| script.js | 2 | `// KAHALANY.DEV — Portfolio Site Scripts` | `// KAYMEN.DEV — Portfolio Site Scripts` |
| tracker.js | 1 | `/* Lightweight analytics tracker — kahalany.dev */` | `/* Lightweight analytics tracker — kaymen.dev */` |
| styles.css | 2 | `KAHALANY.DEV — Portfolio Site Styles` | `KAYMEN.DEV — Portfolio Site Styles` |
| admin/styles.css | 1 | `/* Admin Panel Styles — kahalany.dev */` | `/* Admin Panel Styles — kaymen.dev */` |
| portal/styles.css | 1 | `/* Client Portal Styles — kahalany.dev */` | `/* Client Portal Styles — kaymen.dev */` |

### 1.9 Documentation

**APP-MAP.md** — Full update of all 14 occurrences:
- Header, overview, live URL, repo URL, domain references
- Email addresses (hello@kahalany.dev → hello@kaymen.dev)
- Subdomains, Docker volume docs, logo text references
- Claude Code server URL (code.kahalany.dev → code.kaymen.dev)
- Deployment docs

**PROGRESS.md** — Add new dated entry at top:
```
## 2026-04-XX — Rebrand: kahalany.dev → kaymen.dev
- Domain kaymen.dev purchased, DNS configured
- All code references updated (18 files, ~45 edits)
- Brand name: kaymen.dev (lowercase), entity: Kaymen Group LLC
- Both domains running in parallel via Coolify
- Old domain kahalany.dev to be retired with 301 redirects later
```
Leave all historical entries intact — they accurately describe what happened.

**CLIENT-PORTAL-PLAN.md** and **USER-PORTAL.md** — Add a header note:
```
> **Note**: This document was written under the original "Kahalany.Dev" brand.
> The practice has since rebranded to kaymen.dev.
```
Leave body content as-is (historical planning documents).

### 1.10 No Changes Needed

| File | Reason |
|------|--------|
| favicon.svg | "K" letter works for both brands |
| server/db.js | `ohavkahalany@gmail.com` is a personal Gmail, not brand. Only runs on fresh empty DB. |
| Docker volume name | `kahalany-dev-data` is internal/invisible. Renaming risks data loss. |
| .dockerignore | No brand references |
| Dockerfile | No brand references |

---

## Phase 2: Infrastructure Setup

### 2.1 Cloudflare DNS (kaymen.dev)

Add these DNS records in Cloudflare for the kaymen.dev zone:

| Type | Name | Content | Proxy Status |
|------|------|---------|-------------|
| A | `@` (root) | `178.156.245.71` | DNS only (grey cloud) |
| A | `nodeai` | `178.156.245.71` | DNS only |
| A | `predictable` | `178.156.245.71` | DNS only |
| A | `davenen` | `178.156.245.71` | DNS only |

For `code.kaymen.dev` — set up via Cloudflare Tunnel (same as current code.kahalany.dev setup):
- Add `code.kaymen.dev` as a public hostname in Zero Trust dashboard
- Point to `localhost:3141`

### 2.2 Cloudflare Email Routing (kaymen.dev)

1. Go to kaymen.dev zone → Email → Email Routing
2. Enable Email Routing
3. Add MX records when prompted
4. Create routing rule: `hello@kaymen.dev` → forwarding target (Gmail)
5. Verify destination email if new

### 2.3 Coolify — Add Domain Alongside (No Interference)

**This keeps kahalany.dev working while kaymen.dev is being set up.**

1. Go to app UUID `zcco40skss0o8wwocs40k4gs` → Settings
2. Update the FQDN field to include both domains: `https://kahalany.dev,https://kaymen.dev`
3. Traefik auto-provisions a Let's Encrypt SSL cert for kaymen.dev
4. Both domains now serve the same container — zero downtime
5. Do the same for subdomain apps if they are separate Coolify applications

### 2.4 GitHub

**Option A — Rename (recommended):**
1. Rename GitHub org: `kahalanydev` → `kaymendev` (Org Settings → rename)
2. Rename repo: `kahalany.dev` → `kaymen.dev` (Repo Settings → rename)
3. GitHub auto-redirects old URLs
4. Update local remote:
   ```bash
   git remote set-url origin https://github.com/kaymendev/kaymen.dev.git
   ```
5. Verify Coolify webhook still fires (check Coolify app → Source settings)

**Option B — New org + transfer:**
1. Create new `kaymendev` GitHub org
2. Transfer repo from `kahalanydev/kahalany.dev` to `kaymendev`
3. Rename repo to `kaymen.dev`
4. Update local remote + Coolify

**Option C — Fresh repo (not recommended):**
- Loses all commit history, stars, issues

### 2.5 Claude Code Desktop

- Update allowed origins in the Claude Code Desktop server config to include `https://kaymen.dev`
- This is in the Claude-Code-Desk-Mobile project's CORS settings

### 2.6 SMTP From Address

After deploying, go to Admin → Settings → Integrations → SMTP and update:
- "From" field from `"Kahalany.Dev" <hello@kahalany.dev>` to `"kaymen.dev" <hello@kaymen.dev>`
- This is stored in the database config table, not in code

### 2.7 Docker Volume — NO CHANGE

The volume `kahalany-dev-data` is an internal Docker identifier mounted at `/app/data`. Renaming it requires:
- Creating a new volume
- Copying SQLite data
- Updating Coolify's internal PostgreSQL (volume mount records)

**Risk of data loss is high, user-facing benefit is zero.** Leave it.

---

## Phase 3: Deploy & Verify

### 3.1 Deploy Sequence

1. Commit all Phase 1 code changes in a single commit
2. Push to GitHub
3. If repo was renamed, ensure Coolify source URL is updated first
4. Coolify auto-deploys via webhook
5. Verify both `https://kahalany.dev` and `https://kaymen.dev` serve the updated app

### 3.2 Verification Checklist

**Main Site (https://kaymen.dev):**
- [ ] Page loads with correct title: `kaymen.dev — Custom Software Solutions`
- [ ] Nav logo shows `{ kaymen.dev }`
- [ ] Footer logo shows `{ kaymen.dev }`
- [ ] Copyright shows `© 2026 Kaymen Group LLC`
- [ ] Contact email shows and links to `hello@kaymen.dev`
- [ ] Portfolio "View Live" links use `*.kaymen.dev` subdomains
- [ ] Subdomain links actually resolve and load the correct apps
- [ ] Contact form submission delivers email to forwarding target
- [ ] WhatsApp link still works (unchanged)

**Admin Panel (https://kaymen.dev/admin):**
- [ ] Login page shows `{ kaymen.dev }` logo
- [ ] Sidebar logo shows `{ kaymen.dev }`
- [ ] Settings → Claude Code default URL shows `code.kaymen.dev`
- [ ] Settings → SMTP placeholder shows `kaymen.dev` branding
- [ ] SMTP test email arrives with `kaymen.dev — SMTP Test` subject
- [ ] PWA install shows `kaymen.dev Admin`

**Client Portal (https://kaymen.dev/portal):**
- [ ] Login page shows `{ kaymen.dev }` logo
- [ ] Sidebar logo shows `{ kaymen.dev }`
- [ ] PWA install shows `kaymen.dev Portal`

**Email System:**
- [ ] hello@kaymen.dev forwards to correct inbox
- [ ] Invite emails say `kaymen.dev` in subject
- [ ] Password reset emails say `kaymen.dev` in subject
- [ ] Email HTML template shows `{ kaymen.dev }` logo

**Infrastructure:**
- [ ] SSL certificate valid for kaymen.dev
- [ ] kahalany.dev still works (parallel operation)
- [ ] Claude Code connects via code.kaymen.dev
- [ ] GitHub repo accessible at new URL
- [ ] Coolify auto-deploy webhook fires on push

---

## Phase 4: Retire Old Domain (When Ready)

This phase happens later, once you're confident kaymen.dev is fully operational and clients have been notified.

### 4.1 Set Up 301 Redirects

In Cloudflare for the kahalany.dev zone, create redirect rules:

| Match | Redirect To | Type |
|-------|-------------|------|
| `*kahalany.dev/*` | `https://kaymen.dev/$1` | 301 Permanent |
| `nodeai.kahalany.dev/*` | `https://nodeai.kaymen.dev/$1` | 301 Permanent |
| `predictable.kahalany.dev/*` | `https://predictable.kaymen.dev/$1` | 301 Permanent |
| `davenen.kahalany.dev/*` | `https://davenen.kaymen.dev/$1` | 301 Permanent |

### 4.2 Remove From Coolify

Update Coolify FQDN from `https://kahalany.dev,https://kaymen.dev` to just `https://kaymen.dev`.

### 4.3 Verify Redirects

- [ ] `https://kahalany.dev` → `https://kaymen.dev`
- [ ] `https://kahalany.dev/admin` → `https://kaymen.dev/admin`
- [ ] `https://kahalany.dev/portal` → `https://kaymen.dev/portal`
- [ ] `https://nodeai.kahalany.dev` → `https://nodeai.kaymen.dev`

### 4.4 Domain Renewal Decision

Keep kahalany.dev renewed for at least 1 year after the rebrand to maintain redirects for SEO and existing links. After that, decide whether to let it expire.

---

---

## Plan B: Frontend-Only Rebrand (Simpler)

Instead of touching all 107 occurrences, only change what visitors and clients actually see. Leave all internal/backend plumbing as "kahalany". This cuts the work roughly in half and avoids touching infrastructure that works fine.

### What Changes (frontend-facing only)

**index.html** (10 edits — same as Plan A):
- Page title → `kaymen.dev — Custom Software Solutions`
- Subdomain display URLs + hrefs → `*.kaymen.dev`
- Contact email display + mailto → `hello@kaymen.dev`
- Footer logo → `{ kaymen.dev }`
- Copyright → `© 2026 Kaymen Group LLC`

**admin/app.js** (6 edits — logos + device name only):
- 4 logo instances → `{ kaymen.dev }`
- Device name → `Kaymen Admin Panel`
- Claude Code URL → `code.kaymen.dev` (clients connect through this)

**portal/app.js** (4 edits — logos only):
- 4 logo instances → `{ kaymen.dev }`

**admin/index.html + portal/index.html** (2 edits):
- Page titles → kaymen.dev

**admin/manifest.json + portal/manifest.json** (4 edits):
- PWA names + descriptions → kaymen.dev

**Client-facing server output** (5 edits):
- server/utils/email.js lines 56, 70, 91 — email HTML logo + subjects (clients see these)
- server/routes/dev.js line 379 — portal URL in ticket emails
- server/routes/dev.js line 25 — default org email for new orgs

**Total: ~31 edits across 10 files**

### What Stays As-Is (internal only)

| File/Thing | Why It Can Stay |
|-----------|----------------|
| Code comments (5 files) | Nobody sees these |
| package.json name | Internal npm identifier |
| package-lock.json | Auto-generated |
| GitHub repo/org name | Internal, just a URL you use |
| server/index.js `to:` email | Contact form sends to YOUR inbox — works regardless of brand name. Only change if you set up hello@kaymen.dev forwarding. |
| server/routes/auth.js SMTP test subject | Only you see this in admin |
| admin/app.js SMTP placeholder text | Only you see this in settings |
| APP-MAP.md, PROGRESS.md, etc. | Developer-only docs |
| Docker volume name | Internal, renaming risks data loss |
| .git/config remote URL | Internal |

### Infrastructure (Same as Plan A but less GitHub work)

- Cloudflare DNS: same A records needed
- Cloudflare Email Routing: set up hello@kaymen.dev (recommended but optional — you could keep using hello@kahalany.dev behind the scenes)
- Coolify: add kaymen.dev as additional FQDN (same as Plan A)
- GitHub: **no change needed** — repo stays as kahalanydev/kahalany.dev
- Claude Code: add kaymen.dev to allowed origins

### Plan B Trade-offs

| | Pro | Con |
|---|-----|-----|
| **Simplicity** | Half the edits, no GitHub/package renaming | Internal references still say "kahalany" |
| **Risk** | Less chance of breaking something | Slightly confusing if a new dev joins and sees mixed naming |
| **Speed** | Can be done in 15 minutes | — |
| **Reversibility** | Easy to undo | — |
| **Completeness** | — | Grep for "kahalany" will still return hits in comments/docs/config |

### Recommendation

**Start with Plan B.** It gets kaymen.dev live with correct branding for all visitors and clients. The internal cleanup (Plan A extras) can always be done later as a separate housekeeping task — it's not blocking anything.

---

## Summary

### Plan A: Full Rebrand
| Phase | What | Who | Scope |
|-------|------|-----|-------|
| 1 | Code changes (18 files, ~45 edits) | Claude | All references |
| 2 | Infrastructure (DNS, email, Coolify, GitHub rename) | Ohav | Full |
| 3 | Deploy & verify | Both | Full checklist |
| 4 | Retire old domain | Ohav | When ready |

### Plan B: Frontend-Only Rebrand (Recommended)
| Phase | What | Who | Scope |
|-------|------|-----|-------|
| 1 | Code changes (10 files, ~31 edits) | Claude | User-facing only |
| 2 | Infrastructure (DNS, email, Coolify — no GitHub) | Ohav | Minimal |
| 3 | Deploy & verify | Both | Shorter checklist |
| 4 | Retire old domain | Ohav | When ready |
| 5 | (Optional) Internal cleanup | Claude | Plan A leftovers, whenever |

Phase 1 and Phase 2 can happen in parallel.
