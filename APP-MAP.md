# Kahalany.Dev — Application Map

## Overview
Portfolio/showcase website for Kahalany.Dev — a custom software development practice. Static site with no backend, deployed via Docker (nginx:alpine) on Coolify. Showcases 8 production projects with CSS device mockups, project filtering, and responsive design.

- **Live URL**: https://kahalany.dev
- **Repo**: https://github.com/kahalanydev/kahalany.dev
- **Coolify UUID**: `zcco40skss0o8wwocs40k4gs`

## Tech Stack
- **HTML/CSS/JS** — vanilla, no framework, no build step
- **Fonts** — Inter (body) + JetBrains Mono (code/accents) via Google Fonts
- **Deployment** — nginx:alpine Docker container on Coolify (Hetzner VPS)
- **SSL** — Let's Encrypt via Traefik (auto-provisioned)
- **Domain** — kahalany.dev on Cloudflare (DNS only, not proxied)
- **Email** — hello@kahalany.dev via Cloudflare Email Routing → kahalanydev@gmail.com

## File Structure
```
Kahalany.Dev Site/
├── index.html          # Single-page site (5 sections)
├── styles.css          # All styles including CSS device mockups (~1400 lines)
├── script.js           # Interactions: nav, filters, counters, animations
├── favicon.svg         # Branded "K" favicon (SVG)
├── Dockerfile          # nginx:alpine, port 8080
├── nginx.conf          # Gzip, caching, security headers
├── APP-MAP.md          # This file
└── PROGRESS.md         # Development log
```

## Site Sections

### 1. Navigation
- Fixed top nav with blur backdrop on scroll
- Logo: `{ kahalany.dev }` in JetBrains Mono
- Links: Work, Capabilities, Process, Let's Talk (CTA)
- Mobile: hamburger → fullscreen overlay menu

### 2. Hero
- Rotating text animation: "ships" / "scales" / "works" / "lasts"
- Green pulse "Available for new projects" badge
- Animated counters: 12+ Production Apps, 6 Tech Stacks, 5 Live Platforms
- Two CTAs: "See Our Work" / "Start a Project"
- Subtle grid background + radial glow

### 3. Portfolio (Work)
- **Filter bar**: All / Web Apps / Mobile / AI·ML / WordPress
- **8 project cards**, each with:
  - CSS device mockup (browser frame or phone frame with stylized UI inside)
  - Tech stack tags
  - Status badge (Live, V5.36, App Store, 76+ Tools, Desktop)
  - Description + feature tags
  - "View Live" link (for deployed projects)
- Filter uses `data-tags` attributes, JS toggles `.hidden` class

#### CSS Device Mockups
Each project has a unique CSS-only visual representation:
| Project | Mockup Type | Key Visual Elements |
|---------|-------------|-------------------|
| NodeAI | Browser | Sidebar, stat cards, map with pins, data table |
| Predictable | Browser | Dark theme, stock chart with green fill, verdict banner, score circles |
| OLAMI | Browser | Purple sidebar, stat counters, check-in grid with checkmarks |
| Torah Tracker | **Phone** | Notch, progress ring (75%), streak flame, session list, bottom nav |
| ShipHero AI | Browser | Chat interface, user/AI bubbles, tool call indicator |
| Davenen | Browser | Hero section, CTA button, partner cards with day counters |
| Gemach | Browser | $12,450 balance hero, metric cards, amber balance chart |
| Claude Code UI | Browser | File tree sidebar, tab bar, code block, git diff (red/green) |

### 4. Capabilities
- 6 cards in 3-column grid (responsive to 2-col / 1-col):
  - Full-Stack Web Apps
  - Mobile Apps
  - AI & Machine Learning
  - WordPress & Plugins
  - Infrastructure & DevOps
  - Desktop Apps
- Each card: icon, description, tech tags

### 5. Process ("How We Work")
- 4-step vertical timeline with connecting line:
  1. Understand → 2. Architect → 3. Build → 4. Deploy & Support

### 6. Contact
- Two-column card: CTA text + code block visual
- `new-project.ts` code snippet with syntax highlighting
- Email link: hello@kahalany.dev
- Code block has macOS-style window chrome (red/yellow/green dots)

### 7. Footer
- Logo, nav links, copyright

## JavaScript Features (script.js)
- **Nav scroll**: adds `.scrolled` class for blur backdrop + border
- **Hamburger**: toggles mobile menu with body scroll lock
- **Counter animation**: IntersectionObserver triggers count-up on hero stats
- **Rotating text**: cycles hero highlight word every 2.5s with fade transition
- **Scroll animations**: `.fade-in` → `.visible` via IntersectionObserver
- **Project filters**: click filter button → toggle `.hidden` on cards by `data-tags`
- **Smooth scroll**: all `#anchor` links use `scrollIntoView`

## CSS Architecture
- CSS custom properties for theming (dark theme only currently)
- Two font families: `--font` (Inter) and `--mono` (JetBrains Mono)
- All mockup components namespaced with `m-` prefix
- Responsive breakpoints: 1024px, 768px, 480px
- Animations: `pulse-dot` (badge), `scroll-pulse` (hero scroll indicator)

## Deployment
- **Docker**: `nginx:alpine` serves static files on port 8080
- **Coolify**: public repo, auto-deploy on push to `master`
- **Traefik**: routes `kahalany.dev` → container:8080, auto-SSL
- **No database, no backend, no build step**
