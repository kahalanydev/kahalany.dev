const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const { initDb, seedAdmin } = require('./db');

const authRoutes = require('./routes/auth');
const trackRoutes = require('./routes/track');
const adminRoutes = require('./routes/admin');
const portalRoutes = require('./routes/portal');
const devRoutes = require('./routes/dev');
const uploadRoutes = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy (behind Traefik)
app.set('trust proxy', true);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// Body parsing (verify callback captures raw body for HMAC signature verification)
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = buf.toString(); }
}));

// Block access to sensitive paths
app.use('/server', (req, res) => res.status(404).end());
app.use('/node_modules', (req, res) => res.status(404).end());
app.use('/data', (req, res) => res.status(404).end());
app.use('/package.json', (req, res) => res.status(404).end());
app.use('/package-lock.json', (req, res) => res.status(404).end());
app.use('/.dockerignore', (req, res) => res.status(404).end());

// Contact form (public, rate-limited, honeypot-protected)
const contactLimiter = {};
app.post('/api/contact', async (req, res) => {
  const { name, email, message, project_name, _hp, _t } = req.body;

  // Honeypot: hidden field filled = bot
  if (_hp) return res.json({ success: true }); // silent success to not tip off bots
  // Timing: submitted in under 2 seconds = bot
  if (typeof _t === 'number' && _t < 2000) return res.json({ success: true });

  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();
  if (contactLimiter[ip] && now - contactLimiter[ip] < 60000) {
    return res.status(429).json({ error: 'Please wait a minute before sending another message' });
  }
  contactLimiter[ip] = now;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long' });
  }

  const { getDb } = require('./db');
  const db = getDb();

  db.prepare('INSERT INTO contact_submissions (name, email, message, project_name, ip, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))')
    .run(name, email.trim(), message, project_name ? project_name.trim() : null, ip);

  // Try to send email notification
  try {
    const { sendEmail } = require('./utils/email');
    const projectLine = project_name ? `<p><strong>Project:</strong> ${project_name}</p>` : '';
    await sendEmail({
      to: 'hello@kahalany.dev',
      subject: `New project inquiry from ${name}${project_name ? ` — ${project_name}` : ''}`,
      html: `<div style="font-family:sans-serif;padding:20px;background:#1a1a2e;color:#e0e0e0;border-radius:12px;max-width:500px">
        <h2 style="color:#3b82f6;margin-bottom:16px">New Project Inquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}" style="color:#3b82f6">${email}</a></p>
        ${projectLine}
        <p><strong>Message:</strong></p>
        <div style="background:#0d0d1a;padding:16px;border-radius:8px;margin-top:8px;white-space:pre-wrap">${message}</div>
      </div>`
    });
  } catch {}

  res.json({ success: true });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/uploads', uploadRoutes);

// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, '..', 'admin'), {
  extensions: ['html'],
  index: 'index.html'
}));

// Serve client portal
app.use('/portal', express.static(path.join(__dirname, '..', 'portal'), {
  extensions: ['html'],
  index: 'index.html'
}));

// Serve main site (static files from root, only allowed extensions)
const STATIC_EXTENSIONS = /\.(html|css|js|svg|png|jpg|jpeg|gif|ico|woff2?|ttf|webp|webmanifest)$/;
app.use((req, res, next) => {
  if (req.path === '/' || STATIC_EXTENSIONS.test(req.path)) {
    return express.static(path.join(__dirname, '..'), {
      index: 'index.html',
      dotfiles: 'deny'
    })(req, res, next);
  }
  next();
});

// Fallback: serve index.html for root paths (SPA-style)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 404 handler — track scanner attempts
const { checkSuspicious } = require('./utils/detection');
app.use((req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  checkSuspicious(ip, req.headers['user-agent'], req.path);
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — return JSON for API routes instead of Express default HTML
app.use((err, req, res, _next) => {
  console.error(`[${req.method} ${req.path}]`, err.message || err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// Initialize database and start server
async function start() {
  await initDb();
  seedAdmin();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Main site: http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`Client portal: http://localhost:${PORT}/portal`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
