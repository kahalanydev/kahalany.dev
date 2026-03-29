const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const { initDb, seedAdmin } = require('./db');

const authRoutes = require('./routes/auth');
const trackRoutes = require('./routes/track');
const adminRoutes = require('./routes/admin');

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

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Block access to sensitive paths
app.use('/server', (req, res) => res.status(404).end());
app.use('/node_modules', (req, res) => res.status(404).end());
app.use('/data', (req, res) => res.status(404).end());
app.use('/package.json', (req, res) => res.status(404).end());
app.use('/package-lock.json', (req, res) => res.status(404).end());
app.use('/.dockerignore', (req, res) => res.status(404).end());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/admin', adminRoutes);

// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, '..', 'admin'), {
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

// Initialize database and start server
async function start() {
  await initDb();
  seedAdmin();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Main site: http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
